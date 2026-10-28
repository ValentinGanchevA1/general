import { Injectable } from '@nestjs/common';
import { InjectDataSource } from '@nestjs/typeorm';
import { createHash } from 'node:crypto';
import { DataSource } from 'typeorm';
import * as h3 from 'h3-js';

import {
  cellsForViewport,
  h3ResolutionForZoom,
  isEntityZoom,
  type MapClusterPoint,
  type MapDiscoveryPoint,
  type MapDiscoveryResponse,
  type PlaceMapEntityPoint,
  type Viewport,
} from '@g88/shared';

const MAX_DISCOVERABLE_PLACE_ROWS = 1_000;
const MAX_POINTS_PER_RESPONSE = 500;
const PLACE_CELL_RESOLUTION = 7;

interface DiscoverablePlaceRow {
  id: string;
  canonical_label: string;
  location_h3_r7: string;
  last_emitted_at: Date | string;
}

/**
 * Privacy-safe place discovery for the map.
 *
 * The catalog itself is not a discovery signal because catalog rows are created
 * by explicit check-ins. A place becomes map-discoverable only while an existing
 * k-anonymous Pulse trend is active. The only spatial value exposed is the H3 r7
 * centroid already used by Place Detail.
 */
@Injectable()
export class PlaceMapDiscoveryService {
  constructor(@InjectDataSource() private readonly db: DataSource) {}

  async nearby(viewport: Viewport, zoom: number): Promise<MapDiscoveryResponse> {
    const resolution = h3ResolutionForZoom(zoom);
    const viewportCells = cellsForViewport(viewport, resolution);
    const viewportCellSet = new Set(viewportCells);

    if (viewportCells.length === 0) {
      return this.response([], resolution, viewport, zoom);
    }

    const rows = await this.db.query<DiscoverablePlaceRow[]>(
      `SELECT p.id,
              p.canonical_label,
              p.location_h3_r7,
              t.last_emitted_at
         FROM pulse_place_trends t
         JOIN nexa_places p ON p.id = t.place_id
        WHERE t.expires_at > NOW()
          AND p.status = 'active'
          AND t.place_id IS NOT NULL
        ORDER BY t.last_emitted_at DESC
        LIMIT $1`,
      [MAX_DISCOVERABLE_PLACE_ROWS],
    );

    const places = rows
      .map((row) => this.toEntityPoint(row, resolution, viewportCellSet))
      .filter((point): point is PlaceMapEntityPoint => point != null);

    const points = isEntityZoom(zoom)
      ? places.slice(0, MAX_POINTS_PER_RESPONSE)
      : this.cluster(places, resolution).slice(0, MAX_POINTS_PER_RESPONSE);

    return this.response(points, resolution, viewport, zoom);
  }

  private toEntityPoint(
    row: DiscoverablePlaceRow,
    resolution: number,
    viewportCells: ReadonlySet<string>,
  ): PlaceMapEntityPoint | null {
    const cell = row.location_h3_r7;
    if (!h3.isValidCell(cell) || h3.getResolution(cell) !== PLACE_CELL_RESOLUTION) return null;

    const [lat, lng] = h3.cellToLatLng(cell);
    const viewportCell = this.cellAtResolution(cell, lat, lng, resolution);
    if (!viewportCells.has(viewportCell)) return null;

    const emittedAt = new Date(row.last_emitted_at);
    if (Number.isNaN(emittedAt.getTime())) return null;

    return {
      kind: 'place',
      id: row.id,
      lat,
      lng,
      meta: {
        canonicalLabel: row.canonical_label,
        trending: true,
        recentActivityAt: emittedAt.toISOString(),
        locationPrecision: 'coarse',
      },
    };
  }

  private cellAtResolution(
    r7Cell: string,
    lat: number,
    lng: number,
    resolution: number,
  ): string {
    if (resolution === PLACE_CELL_RESOLUTION) return r7Cell;
    if (resolution < PLACE_CELL_RESOLUTION) return h3.cellToParent(r7Cell, resolution);
    return h3.latLngToCell(lat, lng, resolution);
  }

  private cluster(
    places: PlaceMapEntityPoint[],
    resolution: number,
  ): MapClusterPoint[] {
    const byCell = new Map<string, number>();
    for (const place of places) {
      const cell = h3.latLngToCell(place.lat, place.lng, resolution);
      byCell.set(cell, (byCell.get(cell) ?? 0) + 1);
    }

    return [...byCell.entries()]
      .sort((left, right) => right[1] - left[1])
      .map(([cellId, count]): MapClusterPoint => {
        const [lat, lng] = h3.cellToLatLng(cellId);
        return {
          kind: 'cluster',
          cellId,
          lat,
          lng,
          count,
          by: { place: count },
        };
      });
  }

  private response(
    points: MapDiscoveryPoint[],
    resolution: number,
    viewport: Viewport,
    zoom: number,
  ): MapDiscoveryResponse {
    return {
      points,
      resolution,
      generatedAt: new Date().toISOString(),
      viewportHash: createHash('sha1')
        .update(JSON.stringify({ viewport, zoom, kind: 'place', thresholded: true }))
        .digest('hex')
        .slice(0, 12),
      diff: null,
    };
  }
}
