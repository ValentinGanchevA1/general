import { Injectable, Logger } from '@nestjs/common';
import { InjectDataSource } from '@nestjs/typeorm';
import { DataSource } from 'typeorm';
import { createHash } from 'node:crypto';
import * as h3 from 'h3-js';

import {
  type DiscoveryResponse,
  type DiscoveryPoint,
  type EntityKind,
  type Viewport,
  h3ResolutionForZoom,
  isEntityZoom,
  cellsForViewport,
} from '@g88/shared';

import { PresenceService } from '../presence/presence.service';

const DEFAULT_KINDS: EntityKind[] = ['user', 'event', 'listing'];

/** Hard cap to keep one viewport from returning a runaway payload. */
const MAX_POINTS_PER_RESPONSE = 500;

@Injectable()
export class DiscoveryService {
  private readonly logger = new Logger(DiscoveryService.name);

  constructor(
    @InjectDataSource() private readonly db: DataSource,
    private readonly presence: PresenceService,
  ) {}

  async nearby(params: {
    viewport: Viewport;
    zoom: number;
    kinds?: EntityKind[];
    requesterId: string;
  }): Promise<DiscoveryResponse> {
    const kinds = params.kinds?.length ? params.kinds : DEFAULT_KINDS;
    const resolution = h3ResolutionForZoom(params.zoom);
    const cells = cellsForViewport(params.viewport, resolution);

    if (cells.length === 0) {
      return this.empty(resolution, params.viewport, kinds);
    }

    // Guard: a wildly zoomed-out viewport can produce 10k+ cells.
    // PostGIS handles it but the payload won't. Fall back to a coarser resolution.
    if (cells.length > 5_000) {
      this.logger.warn(`Viewport produced ${cells.length} cells at r${resolution} — refusing`);
      return this.empty(resolution, params.viewport, kinds);
    }

    const points = isEntityZoom(params.zoom)
      ? await this.entitiesInCells(cells, resolution, kinds, params.requesterId)
      : await this.clusterByCell(cells, resolution, kinds, params.requesterId);

    return {
      points,
      resolution,
      generatedAt: new Date().toISOString(),
      viewportHash: this.hashViewport(params.viewport, params.zoom, kinds),
    };
  }

  // ─── Cluster aggregate (low/mid zoom) ────────────────────────────────────

  private async clusterByCell(
    cells: string[],
    resolution: number,
    kinds: EntityKind[],
    requesterId: string,
  ): Promise<DiscoveryPoint[]> {
    const cellCol = this.cellColumn(resolution);

    // SECURITY: cellCol comes from a private helper that whitelists resolutions;
    // it is never user-controlled. Other params are bound via $1, $2, $3.
    const rows: Array<{ cell: string; kind: EntityKind; n: string }> = await this.db.query(
      `
      SELECT ${cellCol} AS cell, kind, COUNT(*)::text AS n
        FROM v_discoverable_entity
       WHERE ${cellCol} = ANY($1::text[])
         AND kind = ANY($2::text[])
         AND visibility = 'public'
         AND id <> $3
       GROUP BY ${cellCol}, kind
      `,
      [cells, kinds, requesterId],
    );

    // Roll up per cell, attach the by-kind breakdown the client uses for tinting.
    const byCell = new Map<
      string,
      { count: number; by: Partial<Record<EntityKind, number>> }
    >();

    for (const row of rows) {
      const n = Number(row.n);
      const slot = byCell.get(row.cell) ?? { count: 0, by: {} };
      slot.count += n;
      slot.by[row.kind] = (slot.by[row.kind] ?? 0) + n;
      byCell.set(row.cell, slot);
    }

    const points: DiscoveryPoint[] = [];
    for (const [cellId, slot] of byCell) {
      const [lat, lng] = h3.cellToLatLng(cellId);
      points.push({
        kind: 'cluster',
        cellId,
        lat,
        lng,
        count: slot.count,
        by: slot.by,
      });
      if (points.length >= MAX_POINTS_PER_RESPONSE) break;
    }
    return points;
  }

  // ─── Individual entities (high zoom) ─────────────────────────────────────

  private async entitiesInCells(
    cells: string[],
    resolution: number,
    kinds: EntityKind[],
    requesterId: string,
  ): Promise<DiscoveryPoint[]> {
    const cellCol = this.cellColumn(resolution);

    const rows: EntityRow[] = await this.db.query(
      `
      SELECT id, kind,
             ST_Y(location::geometry) AS lat,
             ST_X(location::geometry) AS lng,
             meta
        FROM v_discoverable_entity
       WHERE ${cellCol} = ANY($1::text[])
         AND kind = ANY($2::text[])
         AND visibility = 'public'
         AND id <> $3
       LIMIT $4
      `,
      [cells, kinds, requesterId, MAX_POINTS_PER_RESPONSE],
    );

    // Overlay live presence for user entities — only Redis knows who's online RIGHT NOW.
    const userIds = rows.filter((r) => r.kind === 'user').map((r) => r.id);
    const onlineSet = userIds.length
      ? await this.presence.whichAreOnline(userIds)
      : new Set<string>();

    return rows.map((r) => {
      if (r.kind === 'user') {
        return {
          kind: 'user',
          id: r.id,
          lat: r.lat,
          lng: r.lng,
          meta: {
            ...(r.meta as Omit<UserMetaRow, 'online'>),
            online: onlineSet.has(r.id),
          },
        };
      }
      return {
        kind: r.kind,
        id: r.id,
        lat: r.lat,
        lng: r.lng,
        meta: r.meta,
      } as DiscoveryPoint;
    });
  }

  // ─── Helpers ─────────────────────────────────────────────────────────────

  /** Strictly whitelist the H3 cell column name — never accept user input here. */
  private cellColumn(resolution: number): string {
    const allowed = new Set([4, 5, 6, 7, 8, 9, 10]);
    if (!allowed.has(resolution)) {
      // Snap to nearest supported resolution. Keeps the query safe and deterministic.
      const clamped = Math.min(10, Math.max(4, resolution));
      return `location_h3_r${clamped}`;
    }
    return `location_h3_r${resolution}`;
  }

  private hashViewport(viewport: Viewport, zoom: number, kinds: EntityKind[]): string {
    return createHash('sha1')
      .update(JSON.stringify({ viewport, zoom, kinds: [...kinds].sort() }))
      .digest('hex')
      .slice(0, 12);
  }

  private empty(
    resolution: number,
    viewport: Viewport,
    kinds: EntityKind[],
  ): DiscoveryResponse {
    return {
      points: [],
      resolution,
      generatedAt: new Date().toISOString(),
      viewportHash: this.hashViewport(viewport, 0, kinds),
    };
  }
}

// Internal row shapes (not exported — these match the materialized view).
interface EntityRow {
  id: string;
  kind: EntityKind;
  lat: number;
  lng: number;
  meta: Record<string, unknown>;
}

interface UserMetaRow {
  displayName: string;
  avatarUrl: string | null;
  verification: string;
  online: boolean;
  lastSeenAt: string | null;
}
