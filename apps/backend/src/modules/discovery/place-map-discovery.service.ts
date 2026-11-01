import { Injectable } from '@nestjs/common';
import { InjectDataSource } from '@nestjs/typeorm';
import { createHash } from 'node:crypto';
import { DataSource, type EntityManager } from 'typeorm';
import * as h3 from 'h3-js';

import {
  cellsForViewport,
  computeH3Cells,
  h3ResolutionForZoom,
  isEntityZoom,
  type DiscoveryRankBy,
  type MapClusterPoint,
  type MapDiscoveryPoint,
  type MapDiscoveryResponse,
  type PlaceMapEntityPoint,
  type Viewport,
} from '@g88/shared';

import { haversineM } from './ranking/scoring';

const MAX_DISCOVERABLE_PLACE_ROWS = 1_000;
const MAX_POINTS_PER_RESPONSE = 500;
const MAX_PROVIDER_POIS = 10;
const PLACE_CELL_RESOLUTION = 7;
const PROVIDER_REQUEST_TIMEOUT_MS = 2_500;
const PROVIDER_MAX_RESPONSE_BYTES = 256 * 1024;
const MAPTILER_FEATURE_ID_PATTERN = /^\S+\.[0-9]+$/;

interface DiscoverablePlaceRow {
  id: string;
  canonical_label: string;
  location_h3_r7: string;
  last_emitted_at: Date | string;
}

interface CatalogPlaceRow {
  id: string;
  canonical_label: string;
  location_h3_r7: string;
  status: 'active' | 'merged';
  merged_into_place_id: string | null;
}

interface ProviderPoi {
  providerPlaceId: string;
  canonicalLabel: string;
  locationH3R7: string;
}

interface MapTilerFeatureCollection {
  features: unknown[];
}

interface LatLng {
  lat: number;
  lng: number;
}

/**
 * Privacy-safe Place discovery for the map.
 *
 * At entity zoom, public provider POIs are allowed to create/refresh NEXA-owned
 * place identities because the existence of a venue is public provider data,
 * not a human activity signal. Human activity is still attached only through
 * existing k-anonymous Pulse trends. At lower zooms only thresholded trend
 * clusters are returned, which avoids turning broad map browsing into a large
 * provider crawl.
 */
@Injectable()
export class PlaceMapDiscoveryService {
  constructor(@InjectDataSource() private readonly db: DataSource) {}

  async nearby(
    viewport: Viewport,
    zoom: number,
    query?: string,
    rankBy: DiscoveryRankBy = 'relevance',
  ): Promise<MapDiscoveryResponse> {
    const normalizedQuery = query?.trim() ?? '';
    const resolution = h3ResolutionForZoom(zoom);
    const viewportCells = cellsForViewport(viewport, resolution);
    const viewportCellSet = new Set(viewportCells);

    if (viewportCells.length === 0) {
      return this.response([], resolution, viewport, zoom, normalizedQuery, rankBy);
    }

    const trendRows = await this.loadTrendRows(normalizedQuery);
    const trendingPlaces = trendRows
      .map((row) => this.toTrendingEntityPoint(row, resolution, viewportCellSet))
      .filter((point): point is PlaceMapEntityPoint => point != null);

    if (!isEntityZoom(zoom)) {
      const points = this.cluster(trendingPlaces, resolution).slice(0, MAX_POINTS_PER_RESPONSE);
      return this.response(points, resolution, viewport, zoom, normalizedQuery, rankBy);
    }

    const providerPlaces = await this.loadProviderPlaces(
      viewport,
      normalizedQuery,
      resolution,
      viewportCellSet,
    );
    const mergedPlaces = this.mergeProviderAndTrendingPlaces(providerPlaces, trendingPlaces);
    const rankedEntityPlaces = this.rankEntityPlaces(mergedPlaces, viewport, rankBy);

    return this.response(
      rankedEntityPlaces.slice(0, MAX_POINTS_PER_RESPONSE),
      resolution,
      viewport,
      zoom,
      normalizedQuery,
      rankBy,
    );
  }

  private async loadTrendRows(normalizedQuery: string): Promise<DiscoverablePlaceRow[]> {
    return this.db.query<DiscoverablePlaceRow[]>(
      `SELECT p.id,
              p.canonical_label,
              p.location_h3_r7,
              t.last_emitted_at
         FROM pulse_place_trends t
         JOIN nexa_places p ON p.id = t.place_id
        WHERE t.expires_at > NOW()
          AND p.status = 'active'
          AND t.place_id IS NOT NULL
          AND ($2 = '' OR STRPOS(LOWER(p.canonical_label), LOWER($2)) > 0)
        ORDER BY t.last_emitted_at DESC
        LIMIT $1`,
      [MAX_DISCOVERABLE_PLACE_ROWS, normalizedQuery],
    );
  }

  private async loadProviderPlaces(
    viewport: Viewport,
    normalizedQuery: string,
    resolution: number,
    viewportCellSet: ReadonlySet<string>,
  ): Promise<PlaceMapEntityPoint[]> {
    const providerPois = await this.fetchProviderPois(viewport, normalizedQuery);
    if (providerPois.length === 0) return [];

    const points: PlaceMapEntityPoint[] = [];
    for (const providerPoi of providerPois) {
      try {
        const catalogPlace = await this.ensureCatalogPlace(providerPoi);
        const point = this.toProviderEntityPoint(catalogPlace, resolution, viewportCellSet);
        if (point) points.push(point);
      } catch {
        // One bad provider identity must not make the entire map layer fail.
      }
    }
    return points;
  }

  private async fetchProviderPois(
    viewport: Viewport,
    normalizedQuery: string,
  ): Promise<ProviderPoi[]> {
    const apiKey = (process.env.NEXA_MAPTILER_SERVER_API_KEY ?? '').trim();
    if (!apiKey) return [];

    const origin = process.env.NEXA_MAPTILER_REGION === 'global'
      ? 'https://api.maptiler.com'
      : 'https://api.maptiler.eu';
    const centre = this.viewportCentre(viewport);
    const path = normalizedQuery === ''
      ? `${centre.lng},${centre.lat}`
      : encodeURIComponent(normalizedQuery);
    const params = [
      `key=${encodeURIComponent(apiKey)}`,
      `limit=${MAX_PROVIDER_POIS}`,
      'types=poi',
    ];

    if (normalizedQuery !== '') {
      params.push('autocomplete=true');
      params.push(`proximity=${encodeURIComponent(`${centre.lng},${centre.lat}`)}`);
      if (viewport.sw.lng <= viewport.ne.lng) {
        params.push(`bbox=${encodeURIComponent(`${viewport.sw.lng},${viewport.sw.lat},${viewport.ne.lng},${viewport.ne.lat}`)}`);
      }
    }

    try {
      const response = await fetch(
        `${origin}/geocoding/${path}.json?${params.join('&')}`,
        {
          method: 'GET',
          headers: { Accept: 'application/json' },
          redirect: 'error',
          signal: AbortSignal.timeout(PROVIDER_REQUEST_TIMEOUT_MS),
        },
      );
      if (!response.ok) return [];

      const declaredLength = Number(response.headers.get('content-length') ?? '0');
      if (Number.isFinite(declaredLength) && declaredLength > PROVIDER_MAX_RESPONSE_BYTES) return [];

      const text = await response.text();
      if (text.length > PROVIDER_MAX_RESPONSE_BYTES) return [];
      const payload: unknown = JSON.parse(text);
      if (!this.isFeatureCollection(payload)) return [];

      const seen = new Set<string>();
      const result: ProviderPoi[] = [];
      for (const value of payload.features) {
        const providerPoi = this.parseProviderPoi(value, viewport);
        if (!providerPoi || seen.has(providerPoi.providerPlaceId)) continue;
        seen.add(providerPoi.providerPlaceId);
        result.push(providerPoi);
        if (result.length >= MAX_PROVIDER_POIS) break;
      }
      return result;
    } catch {
      return [];
    }
  }

  private parseProviderPoi(value: unknown, viewport: Viewport): ProviderPoi | null {
    if (!this.isRecord(value)) return null;
    const providerPlaceId = typeof value.id === 'string' ? value.id.trim() : '';
    if (
      providerPlaceId.length === 0
      || providerPlaceId.length > 200
      || !MAPTILER_FEATURE_ID_PATTERN.test(providerPlaceId)
      || this.hasControlCharacters(providerPlaceId)
    ) {
      return null;
    }

    const canonicalLabel = this.readCanonicalLabel(value);
    const centre = this.readCenter(value);
    if (!canonicalLabel || !centre || !this.isInsideViewport(centre, viewport)) return null;

    return {
      providerPlaceId,
      canonicalLabel,
      locationH3R7: computeH3Cells(centre.lat, centre.lng).r7,
    };
  }

  private async ensureCatalogPlace(providerPoi: ProviderPoi): Promise<CatalogPlaceRow> {
    return this.db.transaction(async (manager) => {
      const lockKey = `maptiler:${providerPoi.providerPlaceId}`;
      await manager.query('SELECT pg_advisory_xact_lock(hashtext($1))', [lockKey]);

      const existing = await this.findCatalogPlaceByProviderRef(manager, providerPoi.providerPlaceId);
      if (existing) {
        const [updated] = await manager.query<CatalogPlaceRow[]>(
          `UPDATE nexa_places
              SET canonical_label = $2,
                  location_h3_r7 = $3,
                  last_seen_at = NOW(),
                  updated_at = NOW()
            WHERE id = $1
              AND status = 'active'
          RETURNING id, canonical_label, location_h3_r7, status, merged_into_place_id`,
          [existing.id, providerPoi.canonicalLabel, providerPoi.locationH3R7],
        );
        if (!updated) throw new Error('NEXA place is not active.');
        return updated;
      }

      const [created] = await manager.query<CatalogPlaceRow[]>(
        `INSERT INTO nexa_places
           (canonical_label, location_h3_r7, last_seen_at, created_at, updated_at)
         VALUES ($1, $2, NOW(), NOW(), NOW())
         RETURNING id, canonical_label, location_h3_r7, status, merged_into_place_id`,
        [providerPoi.canonicalLabel, providerPoi.locationH3R7],
      );
      if (!created) throw new Error('Failed to create NEXA place.');

      await manager.query(
        `INSERT INTO nexa_place_external_refs
           (place_id, namespace, external_id, last_seen_at, created_at)
         VALUES ($1, 'maptiler', $2, NOW(), NOW())
         ON CONFLICT (namespace, external_id)
         DO UPDATE SET last_seen_at = NOW()`,
        [created.id, providerPoi.providerPlaceId],
      );
      return created;
    });
  }

  private async findCatalogPlaceByProviderRef(
    manager: EntityManager,
    providerPlaceId: string,
  ): Promise<CatalogPlaceRow | null> {
    const [row] = await manager.query<CatalogPlaceRow[]>(
      `SELECT p.id,
              p.canonical_label,
              p.location_h3_r7,
              p.status,
              p.merged_into_place_id
         FROM nexa_place_external_refs r
         JOIN nexa_places p ON p.id = r.place_id
        WHERE r.namespace = 'maptiler'
          AND r.external_id = $1
        LIMIT 1`,
      [providerPlaceId],
    );
    if (!row) return null;

    let current = row;
    for (let depth = 0; current.status === 'merged' && current.merged_into_place_id; depth += 1) {
      if (depth >= 5) return null;
      const [next] = await manager.query<CatalogPlaceRow[]>(
        `SELECT id, canonical_label, location_h3_r7, status, merged_into_place_id
           FROM nexa_places
          WHERE id = $1
          LIMIT 1`,
        [current.merged_into_place_id],
      );
      if (!next) return null;
      current = next;
    }
    return current.status === 'active' ? current : null;
  }

  private toTrendingEntityPoint(
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

  private toProviderEntityPoint(
    row: CatalogPlaceRow,
    resolution: number,
    viewportCells: ReadonlySet<string>,
  ): PlaceMapEntityPoint | null {
    const cell = row.location_h3_r7;
    if (!h3.isValidCell(cell) || h3.getResolution(cell) !== PLACE_CELL_RESOLUTION) return null;

    const [lat, lng] = h3.cellToLatLng(cell);
    const viewportCell = this.cellAtResolution(cell, lat, lng, resolution);
    if (!viewportCells.has(viewportCell)) return null;

    return {
      kind: 'place',
      id: row.id,
      lat,
      lng,
      meta: {
        canonicalLabel: row.canonical_label,
        trending: false,
        recentActivityAt: null,
        locationPrecision: 'coarse',
      },
    };
  }

  private mergeProviderAndTrendingPlaces(
    providerPlaces: readonly PlaceMapEntityPoint[],
    trendingPlaces: readonly PlaceMapEntityPoint[],
  ): PlaceMapEntityPoint[] {
    const byId = new Map<string, PlaceMapEntityPoint>();
    for (const point of providerPlaces) byId.set(point.id, point);
    for (const point of trendingPlaces) byId.set(point.id, point);
    return [...byId.values()];
  }

  private rankEntityPlaces(
    places: PlaceMapEntityPoint[],
    viewport: Viewport,
    rankBy: DiscoveryRankBy,
  ): PlaceMapEntityPoint[] {
    if (rankBy !== 'distance') return places;

    const centre = this.viewportCentre(viewport);
    return [...places].sort((left, right) => (
      haversineM(centre.lat, centre.lng, left.lat, left.lng)
      - haversineM(centre.lat, centre.lng, right.lat, right.lng)
    ));
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

  private viewportCentre(viewport: Viewport): LatLng {
    const lat = (viewport.ne.lat + viewport.sw.lat) / 2;
    if (viewport.sw.lng <= viewport.ne.lng) {
      return { lat, lng: (viewport.sw.lng + viewport.ne.lng) / 2 };
    }

    const wrappedEast = viewport.ne.lng + 360;
    const wrappedCentre = (viewport.sw.lng + wrappedEast) / 2;
    return { lat, lng: wrappedCentre > 180 ? wrappedCentre - 360 : wrappedCentre };
  }

  private isInsideViewport(point: LatLng, viewport: Viewport): boolean {
    const south = Math.min(viewport.sw.lat, viewport.ne.lat);
    const north = Math.max(viewport.sw.lat, viewport.ne.lat);
    if (point.lat < south || point.lat > north) return false;

    if (viewport.sw.lng <= viewport.ne.lng) {
      return point.lng >= viewport.sw.lng && point.lng <= viewport.ne.lng;
    }
    return point.lng >= viewport.sw.lng || point.lng <= viewport.ne.lng;
  }

  private readCanonicalLabel(feature: Record<string, unknown>): string | null {
    const text = typeof feature.text === 'string'
      ? feature.text
      : typeof feature.place_name === 'string'
        ? feature.place_name
        : '';
    const normalized = text.trim().split(/\s+/u).join(' ');
    if (normalized.length < 2 || normalized.length > 80 || this.hasControlCharacters(normalized)) {
      return null;
    }
    return normalized;
  }

  private readCenter(feature: Record<string, unknown>): LatLng | null {
    const fromCenter = this.readLngLatArray(feature.center);
    if (fromCenter) return fromCenter;
    if (!this.isRecord(feature.geometry) || feature.geometry.type !== 'Point') return null;
    return this.readLngLatArray(feature.geometry.coordinates);
  }

  private readLngLatArray(value: unknown): LatLng | null {
    if (!Array.isArray(value) || value.length < 2) return null;
    const lng = value[0];
    const lat = value[1];
    if (typeof lat !== 'number' || typeof lng !== 'number') return null;
    if (!Number.isFinite(lat) || !Number.isFinite(lng)) return null;
    if (lat < -90 || lat > 90 || lng < -180 || lng > 180) return null;
    return { lat, lng };
  }

  private isFeatureCollection(value: unknown): value is MapTilerFeatureCollection {
    return this.isRecord(value) && Array.isArray(value.features);
  }

  private isRecord(value: unknown): value is Record<string, unknown> {
    return typeof value === 'object' && value !== null;
  }

  private hasControlCharacters(input: string): boolean {
    for (const char of input) {
      const code = char.charCodeAt(0);
      if (code < 32 || code === 127) return true;
    }
    return false;
  }

  private response(
    points: MapDiscoveryPoint[],
    resolution: number,
    viewport: Viewport,
    zoom: number,
    query: string,
    rankBy: DiscoveryRankBy,
  ): MapDiscoveryResponse {
    return {
      points,
      resolution,
      generatedAt: new Date().toISOString(),
      viewportHash: createHash('sha1')
        .update(JSON.stringify({
          viewport,
          zoom,
          kind: 'place',
          thresholdedActivity: true,
          providerPlacesAtEntityZoom: true,
          query: query.toLocaleLowerCase(),
          rankBy,
        }))
        .digest('hex')
        .slice(0, 12),
      diff: null,
    };
  }
}
