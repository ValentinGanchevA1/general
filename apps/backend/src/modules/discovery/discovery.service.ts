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
  type ListingMode,
  type UserMeta,
  type Viewport,
  h3ResolutionForZoom,
  isEntityZoom,
  cellsForViewport,
} from '@g88/shared';

import { REDIS_CLIENT } from '../../config/redis.provider';
import { PresenceService } from '../presence/presence.service';
import { FriendsService } from '../friends/friends.service';

const DEFAULT_KINDS: EntityKind[] = ['user', 'event', 'listing'];
const MAX_POINTS_PER_RESPONSE = 500;
const MAX_CELLS_PER_VIEWPORT = 200_000;
const H3_CELL_AREA_KM2: Record<number, number> = {
  4: 1770.3, 5: 252.9, 6: 36.13, 7: 5.161, 8: 0.7373, 9: 0.1053, 10: 0.01504,
};
const SNAPSHOT_TTL_SECONDS = 30;
const DIFF_FALLBACK_THRESHOLD = 0.6;

function listingModeSql(mode: ListingMode | undefined): string {
  if (mode === 'buy') return `AND (kind <> 'listing' OR meta->>'mode' = 'buy')`;
  if (mode === 'sell') return `AND (kind <> 'listing' OR COALESCE(meta->>'mode', 'sell') = 'sell')`;
  return '';
}

const TOPIC_MATCH_SQL = (param: string): string =>
  `((kind = 'event'   AND g88_slugify(meta->>'title')    = ${param})
 OR (kind = 'listing' AND g88_slugify(meta->>'category') = ${param}))`;

@Injectable()
export class DiscoveryService {
  private readonly logger = new Logger(DiscoveryService.name);

  constructor(
    @InjectDataSource() private readonly db: DataSource,
    private readonly presence: PresenceService,
    private readonly friends: FriendsService,
    @Inject(REDIS_CLIENT) private readonly redis: Redis,
  ) {}

  async nearby(params: {
    viewport: Viewport;
    zoom: number;
    kinds?: EntityKind[];
    requesterId: string;
    prevViewportHash?: string;
    topic?: string;
    listingMode?: ListingMode;
    /** Close-friend user pins only (events/listings omitted). */
    friendsOnly?: boolean;
  }): Promise<DiscoveryResponse> {
    const friendsOnly = params.friendsOnly === true;
    const topicSlug = friendsOnly
      ? ''
      : params.topic
        ? params.topic.replace(/^#/, '').trim().toLowerCase()
        : '';
    const requested = params.kinds?.length ? params.kinds : DEFAULT_KINDS;
    let kinds = topicSlug
      ? requested.filter((k) => k === 'event' || k === 'listing')
      : requested;
    if (friendsOnly) kinds = ['user'];
    const listingMode: ListingMode | undefined = friendsOnly
      ? undefined
      : params.listingMode === 'buy' || params.listingMode === 'sell'
        ? params.listingMode
        : undefined;
    const friendIds = friendsOnly
      ? await this.friends.listFriendIds(params.requesterId)
      : null;
    const resolution = h3ResolutionForZoom(params.zoom);

    if (friendsOnly && (friendIds == null || friendIds.length === 0)) {
      return this.empty(resolution, params.viewport, kinds, topicSlug, listingMode, true);
    }

    if (this.estimateCellCount(params.viewport, resolution) > MAX_CELLS_PER_VIEWPORT) {
      this.logger.warn(`Viewport too large at r${resolution} — refusing`);
      return this.empty(resolution, params.viewport, kinds, topicSlug, listingMode, friendsOnly);
    }

    const cells = cellsForViewport(params.viewport, resolution);
    if (cells.length === 0 || (topicSlug && kinds.length === 0)) {
      return this.empty(resolution, params.viewport, kinds, topicSlug, listingMode, friendsOnly);
    }
    if (cells.length > 5_000) {
      this.logger.warn(`Viewport produced ${cells.length} cells at r${resolution} — refusing`);
      return this.empty(resolution, params.viewport, kinds, topicSlug, listingMode, friendsOnly);
    }

    const points = isEntityZoom(params.zoom)
      ? await this.entitiesInCells(
          cells, resolution, kinds, params.requesterId, topicSlug, listingMode, friendIds,
        )
      : await this.clusterByCell(
          cells, resolution, kinds, params.requesterId, topicSlug, listingMode, friendIds,
        );

    const viewportHash = this.hashViewport(
      params.viewport, params.zoom, kinds, topicSlug, listingMode, friendsOnly,
    );
    await this.storeSnapshot(viewportHash, points);

    if (params.prevViewportHash) {
      const diff = await this.computeDiff(params.prevViewportHash, points);
      if (diff) {
        return {
          points: [],
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

  private snapshotKey(hash: string): string {
    return `discovery:snap:${hash}`;
  }

  private pointKey(p: DiscoveryPoint): string {
    return p.kind === 'cluster' ? p.cellId : p.id;
  }

  private async storeSnapshot(hash: string, points: DiscoveryPoint[]): Promise<void> {
    await this.redis.set(this.snapshotKey(hash), JSON.stringify(points), 'EX', SNAPSHOT_TTL_SECONDS);
  }

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

    const currentByKey = new Map(currentPoints.map((p) => [this.pointKey(p), p]));
    const prevByKey = new Map(prevPoints.map((p) => [this.pointKey(p), p]));
    const removed: string[] = [];
    const added: DiscoveryPoint[] = [];
    let pureRemovedCount = 0;

    for (const [key, prevPoint] of prevByKey) {
      const curPoint = currentByKey.get(key);
      if (!curPoint) {
        removed.push(key);
        pureRemovedCount += 1;
      } else if (this.canonicalJson(prevPoint) !== this.canonicalJson(curPoint)) {
        removed.push(key);
        added.push(curPoint);
      }
    }
    for (const [key, curPoint] of currentByKey) {
      if (!prevByKey.has(key)) added.push(curPoint);
    }

    if (prevPoints.length > 0 && pureRemovedCount / prevPoints.length > DIFF_FALLBACK_THRESHOLD) {
      return null;
    }
    if (added.length === 0 && removed.length === 0) {
      return { added: [], removed: [] };
    }
    return { added, removed };
  }

  private canonicalJson(value: unknown): string {
    return JSON.stringify(value, (_key, val) =>
      val && typeof val === 'object' && !Array.isArray(val)
        ? Object.keys(val as Record<string, unknown>)
            .sort()
            .reduce<Record<string, unknown>>((acc, k) => {
              acc[k] = (val as Record<string, unknown>)[k];
              return acc;
            }, {})
        : val,
    );
  }

  private async clusterByCell(
    cells: string[],
    resolution: number,
    kinds: EntityKind[],
    requesterId: string,
    topicSlug: string,
    listingMode?: ListingMode,
    friendIds: string[] | null = null,
  ): Promise<DiscoveryPoint[]> {
    const cellCol = this.cellColumn(resolution);
    const listingClause = listingModeSql(listingMode);
    const queryParams: unknown[] = [cells, kinds, requesterId];
    let friendsClause = '';
    if (friendIds != null) {
      queryParams.push(friendIds);
      friendsClause = `AND id = ANY($${queryParams.length}::uuid[])`;
    }
    let topicClause = '';
    if (topicSlug) {
      queryParams.push(topicSlug);
      topicClause = `AND ${TOPIC_MATCH_SQL('$' + String(queryParams.length))}`;
    }
    const rows: Array<{ cell: string; kind: EntityKind; n: string }> = await this.db.query(
      `
      SELECT ${cellCol} AS cell, kind, COUNT(*)::text AS n
        FROM v_discoverable_entity
       WHERE ${cellCol} = ANY($1::text[])
         AND kind = ANY($2::text[])
         AND visibility = 'public'
         AND id <> $3
         AND NOT (kind = 'user' AND EXISTS (
           SELECT 1 FROM user_blocks ub
            WHERE (ub.blocker_id = $3 AND ub.blocked_id = id)
               OR (ub.blocker_id = id AND ub.blocked_id = $3)
         ))
         ${topicClause}
         ${listingClause}
         ${friendsClause}
       GROUP BY ${cellCol}, kind
      `,
      queryParams,
    );

    const byCell = new Map<string, { count: number; by: Partial<Record<EntityKind, number>> }>();
    for (const row of rows) {
      const n = Number(row.n);
      const slot = byCell.get(row.cell) ?? { count: 0, by: {} };
      slot.count += n;
      slot.by[row.kind] = (slot.by[row.kind] ?? 0) + n;
      byCell.set(row.cell, slot);
    }

    const sortedCells = [...byCell].sort((a, b) => b[1].count - a[1].count);
    const points: DiscoveryPoint[] = [];
    for (const [cellId, slot] of sortedCells) {
      const [lat, lng] = h3.cellToLatLng(cellId);
      points.push({ kind: 'cluster', cellId, lat, lng, count: slot.count, by: slot.by });
      if (points.length >= MAX_POINTS_PER_RESPONSE) break;
    }
    return points;
  }

  private async entitiesInCells(
    cells: string[],
    resolution: number,
    kinds: EntityKind[],
    requesterId: string,
    topicSlug: string,
    listingMode?: ListingMode,
    friendIds: string[] | null = null,
  ): Promise<DiscoveryPoint[]> {
    const cellCol = this.cellColumn(resolution);
    const listingClause = listingModeSql(listingMode);
    const queryParams: unknown[] = [cells, kinds, requesterId, MAX_POINTS_PER_RESPONSE];
    let friendsClause = '';
    if (friendIds != null) {
      queryParams.push(friendIds);
      friendsClause = `AND id = ANY($${queryParams.length}::uuid[])`;
    }
    let topicClause = '';
    if (topicSlug) {
      queryParams.push(topicSlug);
      topicClause = `AND ${TOPIC_MATCH_SQL('$' + String(queryParams.length))}`;
    }
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
         AND NOT (kind = 'user' AND EXISTS (
           SELECT 1 FROM user_blocks ub
            WHERE (ub.blocker_id = $3 AND ub.blocked_id = id)
               OR (ub.blocker_id = id AND ub.blocked_id = $3)
         ))
         ${topicClause}
         ${listingClause}
         ${friendsClause}
       ORDER BY v_discoverable_entity.id
       LIMIT $4
      `,
      queryParams,
    );

    const userIds = rows.filter((r) => r.kind === 'user').map((r) => r.id);
    const onlineSet = userIds.length
      ? await this.presence.whichAreOnline(userIds)
      : new Set<string>();
    const friendIdSet =
      userIds.length > 0
        ? new Set(await this.friends.listFriendIds(requesterId))
        : new Set<string>();

    return rows.map((r) => {
      if (r.kind === 'user') {
        const viewMeta = r.meta as unknown as UserMeta;
        return {
          kind: 'user' as const,
          id: r.id,
          lat: r.lat,
          lng: r.lng,
          meta: {
            ...viewMeta,
            online: onlineSet.has(r.id),
            isFriend: friendIdSet.has(r.id),
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

  private estimateCellCount(viewport: Viewport, resolution: number): number {
    const KM_PER_DEG = 111.32;
    const midLatRad = ((viewport.ne.lat + viewport.sw.lat) / 2) * (Math.PI / 180);
    const latKm = Math.abs(viewport.ne.lat - viewport.sw.lat) * KM_PER_DEG;
    const lngDeg = (((viewport.ne.lng - viewport.sw.lng) % 360) + 360) % 360;
    const lngKm = lngDeg * KM_PER_DEG * Math.cos(midLatRad);
    const areaKm2 = latKm * lngKm;
    const cellKm2 = H3_CELL_AREA_KM2[resolution] ?? 0.01504;
    return Math.ceil(areaKm2 / cellKm2);
  }

  private cellColumn(resolution: number): string {
    const allowed = new Set([4, 5, 6, 7, 8, 9, 10]);
    if (!allowed.has(resolution)) {
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
    listingMode?: ListingMode,
    friendsOnly = false,
  ): string {
    return createHash('sha1')
      .update(
        JSON.stringify({
          viewport,
          zoom,
          kinds: [...kinds].sort(),
          topicSlug,
          listingMode: listingMode ?? null,
          friendsOnly,
        }),
      )
      .digest('hex')
      .slice(0, 12);
  }

  private empty(
    resolution: number,
    viewport: Viewport,
    kinds: EntityKind[],
    topicSlug: string,
    listingMode?: ListingMode,
    friendsOnly = false,
  ): DiscoveryResponse {
    return {
      points: [],
      resolution,
      generatedAt: new Date().toISOString(),
      viewportHash: this.hashViewport(viewport, 0, kinds, topicSlug, listingMode, friendsOnly),
      diff: null,
    };
  }
}

type ViewVisibility = 'public' | 'private' | 'blocked';

interface DiscoverableEntityViewRow {
  id: string;
  kind: EntityKind;
  location: unknown;
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

interface EntityRow extends Pick<DiscoverableEntityViewRow, 'id' | 'kind' | 'meta'> {
  lat: number;
  lng: number;
}
