import { Inject, Injectable, Logger } from '@nestjs/common';
import { InjectDataSource } from '@nestjs/typeorm';
import { DataSource } from 'typeorm';
import { createHash } from 'node:crypto';
import * as h3 from 'h3-js';
import type Redis from 'ioredis';

import {
  type DiscoveryResponse,
  type DiscoveryDiff,
  type DiscoveryPoint,
  type EntityKind,
  type UserMeta,
  type Viewport,
  h3ResolutionForZoom,
  isEntityZoom,
  cellsForViewport,
} from '@g88/shared';

import { REDIS_CLIENT } from '../../config/redis.provider';
import { PresenceService } from '../presence/presence.service';

const DEFAULT_KINDS: EntityKind[] = ['user', 'event', 'listing'];

/** Hard cap to keep one viewport from returning a runaway payload. */
const MAX_POINTS_PER_RESPONSE = 500;

/**
 * Pre-allocation OOM bound — NOT the UX cap. The UX limit stays the existing
 * `cells.length > 5_000` post-enumeration check below. This estimate guard only
 * refuses a viewport so large that h3.polygonToCells would allocate enough
 * cell-ids to threaten the process (~200k ids ≈ 30 MB). Real clients pair large
 * viewports with coarse resolutions, so they never approach this; only a forged
 * (huge bbox + fine zoom) request does.
 */
const MAX_CELLS_PER_VIEWPORT = 200_000;

/**
 * Average H3 hexagon area (km²) per resolution. Used to estimate how many cells
 * a viewport spans WITHOUT enumerating them, so an oversized request is rejected
 * before h3.polygonToCells allocates. Source: H3 resolution table.
 */
const H3_CELL_AREA_KM2: Record<number, number> = {
  4: 1770.3, 5: 252.9, 6: 36.13, 7: 5.161, 8: 0.7373, 9: 0.1053, 10: 0.01504,
};

/** Snapshot TTL — after 30s the diff baseline expires and clients get a full response. */
const SNAPSHOT_TTL_SECONDS = 30;

/** Fall back to full response if more than 60% of prev points were removed (big jump). */
const DIFF_FALLBACK_THRESHOLD = 0.6;

@Injectable()
export class DiscoveryService {
  private readonly logger = new Logger(DiscoveryService.name);

  constructor(
    @InjectDataSource() private readonly db: DataSource,
    private readonly presence: PresenceService,
    @Inject(REDIS_CLIENT) private readonly redis: Redis,
  ) {}

  async nearby(params: {
    viewport: Viewport;
    zoom: number;
    kinds?: EntityKind[];
    requesterId: string;
    prevViewportHash?: string;
    topic?: string;
  }): Promise<DiscoveryResponse> {
    // Normalise the topic filter to a bare slug ('#Open-Mic' → 'open-mic') so it
    // compares to g88_slugify() output. Empty/whitespace → no filter.
    const topicSlug = params.topic ? params.topic.replace(/^#/, '').trim().toLowerCase() : '';
    // A topic filter only applies to events/listings (users have no topic), so
    // intersect the requested kinds with those two.
    const requested = params.kinds?.length ? params.kinds : DEFAULT_KINDS;
    const kinds = topicSlug
      ? requested.filter((k) => k === 'event' || k === 'listing')
      : requested;
    const resolution = h3ResolutionForZoom(params.zoom);

    // Guard BEFORE enumerating: a forged viewport (huge bbox + fine zoom) can make
    // h3.polygonToCells allocate millions of cells and OOM the process — which also
    // kills the in-process Socket.IO gateway. Reject using a cheap area estimate.
    if (this.estimateCellCount(params.viewport, resolution) > MAX_CELLS_PER_VIEWPORT) {
      this.logger.warn(
        `Viewport too large at r${resolution} (estimated cells exceed ${MAX_CELLS_PER_VIEWPORT}) — refusing`,
      );
      return this.empty(resolution, params.viewport, kinds, topicSlug);
    }

    const cells = cellsForViewport(params.viewport, resolution);

    if (cells.length === 0 || (topicSlug && kinds.length === 0)) {
      return this.empty(resolution, params.viewport, kinds, topicSlug);
    }

    if (cells.length > 5_000) {
      this.logger.warn(`Viewport produced ${cells.length} cells at r${resolution} — refusing`);
      return this.empty(resolution, params.viewport, kinds, topicSlug);
    }

    const points = isEntityZoom(params.zoom)
      ? await this.entitiesInCells(cells, resolution, kinds, params.requesterId, topicSlug)
      : await this.clusterByCell(cells, resolution, kinds, params.requesterId, topicSlug);

    const viewportHash = this.hashViewport(params.viewport, params.zoom, kinds, topicSlug);

    // Store this snapshot so the next request can diff against it.
    await this.storeSnapshot(viewportHash, points);

    // Attempt a diff against the previous snapshot if the client sent one.
    if (params.prevViewportHash) {
      const diff = await this.computeDiff(params.prevViewportHash, points);
      if (diff) {
        return {
          points: [],      // client keeps its cached points and applies the diff
          resolution,
          generatedAt: new Date().toISOString(),
          viewportHash,
          diff,
        };
      }
    }

    return {
      points,
      resolution,
      generatedAt: new Date().toISOString(),
      viewportHash,
      diff: null,
    };
  }

  // ─── Snapshot + diff helpers ─────────────────────────────────────────────

  private snapshotKey(hash: string): string {
    return `discovery:snap:${hash}`;
  }

  private pointKey(p: DiscoveryPoint): string {
    return p.kind === 'cluster' ? p.cellId : p.id;
  }

  private async storeSnapshot(hash: string, points: DiscoveryPoint[]): Promise<void> {
    await this.redis.set(
      this.snapshotKey(hash),
      JSON.stringify(points),
      'EX',
      SNAPSHOT_TTL_SECONDS,
    );
  }

  /**
   * Returns a diff against the previous snapshot, or null if:
   * - the previous snapshot has expired
   * - the overlap is too small (big viewport jump → full response is smaller)
   */
  private async computeDiff(
    prevHash: string,
    currentPoints: DiscoveryPoint[],
  ): Promise<DiscoveryDiff | null> {
    const raw = await this.redis.get(this.snapshotKey(prevHash));
    if (!raw) return null;

    let prevPoints: DiscoveryPoint[];
    try {
      prevPoints = JSON.parse(raw) as DiscoveryPoint[];
    } catch {
      return null;
    }

    const currentKeys = new Set(currentPoints.map((p) => this.pointKey(p)));
    const prevKeys = new Set(prevPoints.map((p) => this.pointKey(p)));

    const removed = [...prevKeys].filter((k) => !currentKeys.has(k));

    // If more than threshold of prev points were removed, the user jumped far —
    // sending a diff would be larger than the full payload.
    if (prevPoints.length > 0 && removed.length / prevPoints.length > DIFF_FALLBACK_THRESHOLD) {
      return null;
    }

    const added = currentPoints.filter((p) => !prevKeys.has(this.pointKey(p)));

    // Skip diff if nothing changed.
    if (added.length === 0 && removed.length === 0) {
      return { added: [], removed: [] };
    }

    return { added, removed };
  }

  // ─── Cluster aggregate (low/mid zoom) ────────────────────────────────────

  private async clusterByCell(
    cells: string[],
    resolution: number,
    kinds: EntityKind[],
    requesterId: string,
    topicSlug: string,
  ): Promise<DiscoveryPoint[]> {
    const cellCol = this.cellColumn(resolution);

    // SECURITY: cellCol comes from a private helper that whitelists resolutions;
    // it is never user-controlled. Other params (incl. the topic slug) are bound.
    const rows: Array<{ cell: string; kind: EntityKind; n: string }> = await this.db.query(
      `
      SELECT ${cellCol} AS cell, kind, COUNT(*)::text AS n
        FROM v_discoverable_entity
       WHERE ${cellCol} = ANY($1::text[])
         AND kind = ANY($2::text[])
         AND visibility = 'public'
         AND id <> $3
         ${topicSlug ? `AND ${TOPIC_MATCH_SQL('$4')}` : ''}
       GROUP BY ${cellCol}, kind
      `,
      topicSlug ? [cells, kinds, requesterId, topicSlug] : [cells, kinds, requesterId],
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
    topicSlug: string,
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
         ${topicSlug ? `AND ${TOPIC_MATCH_SQL('$5')}` : ''}
       ORDER BY id
       LIMIT $4
      `,
      topicSlug
        ? [cells, kinds, requesterId, MAX_POINTS_PER_RESPONSE, topicSlug]
        : [cells, kinds, requesterId, MAX_POINTS_PER_RESPONSE],
    );

    // Overlay live presence for user entities — only Redis knows who's online RIGHT NOW.
    const userIds = rows.filter((r) => r.kind === 'user').map((r) => r.id);
    const onlineSet = userIds.length
      ? await this.presence.whichAreOnline(userIds)
      : new Set<string>();

    return rows.map((r) => {
      if (r.kind === 'user') {
        const viewMeta = r.meta as unknown as UserMeta;
        return {
          kind: 'user',
          id: r.id,
          lat: r.lat,
          lng: r.lng,
          meta: {
            ...viewMeta,
            online: onlineSet.has(r.id), // overlay live Redis presence; view hardcodes false
          },
        };
      }
      return {
        kind: r.kind,
        id: r.id,
        lat: r.lat,
        lng: r.lng,
        meta: r.meta,
      } as unknown as DiscoveryPoint;
    });
  }

  // ─── Helpers ─────────────────────────────────────────────────────────────

  /**
   * Cheap upper-bound estimate of how many H3 cells a viewport spans, from its
   * bounding-box area ÷ average cell area — no enumeration, so it can't OOM.
   */
  private estimateCellCount(viewport: Viewport, resolution: number): number {
    const KM_PER_DEG = 111.32;
    const midLatRad = ((viewport.ne.lat + viewport.sw.lat) / 2) * (Math.PI / 180);
    const latKm = Math.abs(viewport.ne.lat - viewport.sw.lat) * KM_PER_DEG;
    const lngKm = Math.abs(viewport.ne.lng - viewport.sw.lng) * KM_PER_DEG * Math.cos(midLatRad);
    const areaKm2 = latKm * lngKm;
    // Fall back to the smallest cell area (largest estimate) for unknown resolutions.
    const cellKm2 = H3_CELL_AREA_KM2[resolution] ?? 0.01504;
    return areaKm2 / cellKm2;
  }

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

  private hashViewport(
    viewport: Viewport,
    zoom: number,
    kinds: EntityKind[],
    topicSlug: string,
  ): string {
    return createHash('sha1')
      .update(JSON.stringify({ viewport, zoom, kinds: [...kinds].sort(), topicSlug }))
      .digest('hex')
      .slice(0, 12);
  }

  private empty(
    resolution: number,
    viewport: Viewport,
    kinds: EntityKind[],
    topicSlug: string,
  ): DiscoveryResponse {
    return {
      points: [],
      resolution,
      generatedAt: new Date().toISOString(),
      viewportHash: this.hashViewport(viewport, 0, kinds, topicSlug),
    };
  }
}

/**
 * SQL predicate: the entity matches the bound topic slug. Events match on their
 * title, listings on their category — both slugified via g88_slugify (migration
 * 0023) so they line up with how the trending service derives topics. `param` is
 * the placeholder (e.g. '$4') holding the bare slug; users never match.
 */
const TOPIC_MATCH_SQL = (param: string): string =>
  `((kind = 'event'   AND g88_slugify(meta->>'title')    = ${param})
 OR (kind = 'listing' AND g88_slugify(meta->>'category') = ${param}))`;

// ─── v_discoverable_entity column contract ───────────────────────────────────
// Mirrors the view definition in 0001_initial.sql exactly.
// Update this interface whenever the view's SELECT list changes.
type ViewVisibility = 'public' | 'private' | 'blocked';

interface DiscoverableEntityViewRow {
  id: string;
  kind: EntityKind;
  location: unknown; // geography(Point,4326) — projected via ST_Y/ST_X, never read raw
  location_h3_r4: string;
  location_h3_r5: string;
  location_h3_r6: string;
  location_h3_r7: string;
  location_h3_r8: string;
  location_h3_r9: string;
  location_h3_r10: string;
  visibility: ViewVisibility;
  meta: Record<string, unknown>;
}

// Projected columns returned by the entity-level SELECT; lat/lng are ST_Y/ST_X aliases.
interface EntityRow extends Pick<DiscoverableEntityViewRow, 'id' | 'kind' | 'meta'> {
  lat: number;
  lng: number;
}
