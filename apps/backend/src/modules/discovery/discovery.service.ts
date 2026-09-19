import { Inject, Injectable, Logger } from '@nestjs/common';
import { InjectDataSource } from '@nestjs/typeorm';
import { DataSource } from 'typeorm';
import { createHash } from 'node:crypto';
import * as h3 from 'h3-js';
import type Redis from 'ioredis';

import {
  type DiscoveryRankBy,
  type DiscoveryResponse,
  type DiscoveryDiff,
  type DiscoveryPoint,
  type EntityKind,
  type ListingMode,
  type UserMeta,
  type EventMeta,
  type ListingMeta,
  type Viewport,
  h3ResolutionForZoom,
  isEntityZoom,
  cellsForViewport,
} from '@g88/shared';

import { REDIS_CLIENT } from '../../config/redis.provider';
import { PresenceService } from '../presence/presence.service';
import { FriendsService } from '../friends/friends.service';
import {
  computeRankScore,
  haversineM,
  type RankableEntity,
  type RankContext,
} from './ranking/scoring';

const DEFAULT_KINDS: EntityKind[] = ['user', 'event', 'listing'];
const MAX_POINTS_PER_RESPONSE = 500;
/** Hard cap — refuse before h3.polygonToCells when estimate exceeds this.
 *  Must match the post-enumeration guard below so free-tier (512MB) never
 *  materializes tens of thousands of cell ids (OOM root cause 2026-09-11). */
const MAX_CELLS_PER_VIEWPORT = 5_000;
/** Area estimate can undercount vs polygonToCells; refuse a bit early. */
const ESTIMATE_CELL_MARGIN = 0.8;
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
    friendsOnly?: boolean;
    rankBy?: DiscoveryRankBy;
  }): Promise<DiscoveryResponse> {
    const rankBy: DiscoveryRankBy = params.rankBy ?? 'relevance';
    const kinds = params.kinds?.length ? params.kinds : DEFAULT_KINDS;
    const topicSlug = params.topic?.trim() ? params.topic.trim().toLowerCase() : undefined;
    const listingMode = params.listingMode;
    const friendsOnly = params.friendsOnly === true;
    const resolution = h3ResolutionForZoom(params.zoom);

    const friendIds = friendsOnly
      ? await this.friends.listFriendIds(params.requesterId)
      : null;
    if (friendsOnly && (friendIds == null || friendIds.length === 0)) {
      return this.empty(resolution, params.viewport, kinds, topicSlug, listingMode, true, rankBy);
    }

    const estimate = this.estimateCells(params.viewport, resolution);
    if (estimate > MAX_CELLS_PER_VIEWPORT * ESTIMATE_CELL_MARGIN) {
      this.logger.warn(
        `Viewport estimate ${estimate} cells at r${resolution} — refusing before polygonToCells`,
      );
      return this.empty(resolution, params.viewport, kinds, topicSlug, listingMode, friendsOnly, rankBy);
    }

    const cells = cellsForViewport(params.viewport, resolution);
    if (cells.length === 0 || (topicSlug && kinds.length === 0)) {
      return this.empty(resolution, params.viewport, kinds, topicSlug, listingMode, friendsOnly, rankBy);
    }
    if (cells.length > MAX_CELLS_PER_VIEWPORT) {
      this.logger.warn(`Viewport produced ${cells.length} cells at r${resolution} — refusing`);
      return this.empty(resolution, params.viewport, kinds, topicSlug, listingMode, friendsOnly, rankBy);
    }

    const points = isEntityZoom(params.zoom)
      ? await this.entitiesInCells(
          cells,
          resolution,
          kinds,
          params.requesterId,
          topicSlug,
          listingMode,
          friendIds,
          params.viewport,
          rankBy,
        )
      : await this.clusterByCell(
          cells, resolution, kinds, params.requesterId, topicSlug, listingMode, friendIds,
        );

    const viewportHash = this.hashViewport(
      params.viewport, params.zoom, kinds, topicSlug, listingMode, friendsOnly, rankBy,
    );
    await this.storeSnapshot(viewportHash, points);

    if (params.prevViewportHash) {
      const diff = await this.computeDiff(params.prevViewportHash, points);
      if (diff) {
        return {
          points: [],
          resolution,
          viewportHash,
          generatedAt: new Date().toISOString(),
          diff,
        };
      }
    }

    return {
      points,
      resolution,
      viewportHash,
      generatedAt: new Date().toISOString(),
    };
  }

  private estimateCells(viewport: Viewport, resolution: number): number {
    const areaKm2 =
      Math.abs(viewport.ne.lat - viewport.sw.lat) *
      Math.abs(viewport.ne.lng - viewport.sw.lng) *
      111 *
      111 *
      Math.cos((((viewport.ne.lat + viewport.sw.lat) / 2) * Math.PI) / 180);
    const cellArea = H3_CELL_AREA_KM2[resolution] ?? 0.1;
    return Math.ceil(areaKm2 / cellArea);
  }

  private async clusterByCell(
    cells: string[],
    resolution: number,
    kinds: EntityKind[],
    requesterId: string,
    topicSlug: string | undefined,
    listingMode: ListingMode | undefined,
    friendIds: string[] | null,
  ): Promise<DiscoveryPoint[]> {
    const col = `location_h3_r${resolution}`;
    const topicClause = topicSlug ? ` AND ${TOPIC_MATCH_SQL('$4')}` : '';
    const modeClause = listingModeSql(listingMode);
    const friendClause =
      friendIds != null ? ` AND kind = 'user' AND id = ANY($${topicSlug ? 5 : 4}::uuid[])` : '';

    const queryParams: unknown[] = [cells, kinds, requesterId];
    if (topicSlug) queryParams.push(topicSlug);
    if (friendIds != null) queryParams.push(friendIds);

    const rows = (await this.db.query(
      `SELECT ${col} AS cell_id,
              COUNT(*)::int AS count,
              jsonb_object_agg(kind, cnt) AS by
         FROM (
           SELECT ${col}, kind, COUNT(*)::int AS cnt
             FROM discovery_entity_view
            WHERE ${col} = ANY($1::text[])
              AND kind = ANY($2::text[])
              AND id <> $3
              AND NOT EXISTS (
                SELECT 1 FROM user_blocks ub
                 WHERE (ub.blocker_id = $3 AND ub.blocked_id = id)
                    OR (ub.blocker_id = id AND ub.blocked_id = $3)
              )
              ${topicClause}${modeClause}${friendClause}
            GROUP BY ${col}, kind
         ) t
        GROUP BY ${col}`,
      queryParams,
    )) as Array<{ cell_id: string; count: number; by: Record<string, number> }>;

    const points: DiscoveryPoint[] = [];
    for (const r of rows) {
      if (points.length >= MAX_POINTS_PER_RESPONSE) break;
      const [lat, lng] = h3.cellToLatLng(r.cell_id);
      points.push({
        kind: 'cluster',
        cellId: r.cell_id,
        lat,
        lng,
        count: r.count,
        by: r.by,
      });
    }
    return points;
  }

  private async entitiesInCells(
    cells: string[],
    resolution: number,
    kinds: EntityKind[],
    requesterId: string,
    topicSlug: string | undefined,
    listingMode: ListingMode | undefined,
    friendIds: string[] | null,
    viewport: Viewport,
    rankBy: DiscoveryRankBy,
  ): Promise<DiscoveryPoint[]> {
    const col = `location_h3_r${resolution}`;
    const topicClause = topicSlug ? ` AND ${TOPIC_MATCH_SQL('$5')}` : '';
    const modeClause = listingModeSql(listingMode);
    const friendClause =
      friendIds != null
        ? ` AND kind = 'user' AND id = ANY($${topicSlug ? 6 : 5}::uuid[])`
        : '';

    const centreLat = (viewport.ne.lat + viewport.sw.lat) / 2;
    const centreLng = (viewport.ne.lng + viewport.sw.lng) / 2;

    const queryParams: unknown[] = [cells, kinds, requesterId, MAX_POINTS_PER_RESPONSE];
    if (topicSlug) queryParams.push(topicSlug);
    if (friendIds != null) queryParams.push(friendIds);

    // rankBy=distance: KNN so LIMIT keeps nearest, not arbitrary id order.
    const orderSql =
      rankBy === 'distance'
        ? `ORDER BY location <-> ST_SetSRID(ST_MakePoint(${centreLng}, ${centreLat}), 4326)::geography`
        : `ORDER BY id`;

    const rows = (await this.db.query(
      `SELECT id, kind, meta,
              ST_Y(location::geometry) AS lat,
              ST_X(location::geometry) AS lng
         FROM discovery_entity_view
        WHERE ${col} = ANY($1::text[])
          AND kind = ANY($2::text[])
          AND id <> $3
          AND NOT EXISTS (
            SELECT 1 FROM user_blocks ub
             WHERE (ub.blocker_id = $3 AND ub.blocked_id = id)
                OR (ub.blocker_id = id AND ub.blocked_id = $3)
          )
          ${topicClause}${modeClause}${friendClause}
        ${orderSql}
        LIMIT $4`,
      queryParams,
    )) as Array<{
      id: string;
      kind: EntityKind;
      meta: Record<string, unknown>;
      lat: number;
      lng: number;
    }>;

    const userIds = rows.filter((r) => r.kind === 'user').map((r) => r.id);
    const friendIdSet =
      userIds.length > 0
        ? new Set(await this.friends.listFriendIds(requesterId))
        : new Set<string>();
    // Presence is only visible to close friends, and only when the peer allows it
    // (friends_see_online_status). Non-friends never see online on the map.
    const friendUserIds = userIds.filter((id) => friendIdSet.has(id));
    const allowOnlineSet =
      friendUserIds.length > 0
        ? await this.friends.listWhoAllowFriendsOnline(friendUserIds)
        : new Set<string>();
    const presenceIds = friendUserIds.filter((id) => allowOnlineSet.has(id));
    const onlineSet = presenceIds.length
      ? await this.presence.whichAreOnline(presenceIds)
      : new Set<string>();
    // lastSeen feeds ranking activityScore for offline-but-recent friends.
    const lastSeen =
      presenceIds.length > 0
        ? await this.presence.lastSeenMap(presenceIds)
        : new Map<string, string>();

    let points: DiscoveryPoint[] = rows.map((r) => {
      if (r.kind === 'user') {
        const viewMeta = r.meta as unknown as UserMeta;
        const isFriend = friendIdSet.has(r.id);
        const canShowPresence = isFriend && allowOnlineSet.has(r.id);
        return {
          kind: 'user' as const,
          id: r.id,
          lat: r.lat,
          lng: r.lng,
          meta: {
            ...viewMeta,
            online: canShowPresence && onlineSet.has(r.id),
            lastSeenAt: canShowPresence ? (lastSeen.get(r.id) ?? null) : null,
            isFriend,
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

    if (rankBy === 'relevance') {
      const ctx: RankContext = {
        viewerLat: centreLat,
        viewerLng: centreLng,
        viewerId: requesterId,
      };
      points = points
        .map((p) => {
          if (p.kind === 'cluster') return p;
          const rankable = this.toRankable(p);
          const score = computeRankScore(rankable, ctx);
          return { ...p, rankScore: score };
        })
        .sort((a, b) => {
          if (a.kind === 'cluster' || b.kind === 'cluster') return 0;
          return (b.rankScore ?? 0) - (a.rankScore ?? 0);
        });
    } else if (rankBy === 'newest') {
      points = [...points].sort((a, b) => {
        if (a.kind === 'cluster' || b.kind === 'cluster') return 0;
        const ta = this.timeKey(a);
        const tb = this.timeKey(b);
        return tb - ta;
      });
    } else if (rankBy === 'distance') {
      points = [...points].sort((a, b) => {
        if (a.kind === 'cluster' || b.kind === 'cluster') return 0;
        return (
          haversineM(centreLat, centreLng, a.lat, a.lng) -
          haversineM(centreLat, centreLng, b.lat, b.lng)
        );
      });
    }

    return points.slice(0, MAX_POINTS_PER_RESPONSE);
  }

  private toRankable(p: DiscoveryPoint): RankableEntity {
    if (p.kind === 'cluster') {
      return { id: p.cellId, kind: 'user', lat: p.lat, lng: p.lng };
    }
    if (p.kind === 'user') {
      const m = p.meta as UserMeta;
      return {
        id: p.id,
        kind: 'user',
        lat: p.lat,
        lng: p.lng,
        verification: m.verification,
        isFriend: m.isFriend,
        online: m.online,
        lastSeenAt: m.lastSeenAt,
      };
    }
    if (p.kind === 'event') {
      const m = p.meta as EventMeta;
      return {
        id: p.id,
        kind: 'event',
        lat: p.lat,
        lng: p.lng,
        startsAt: m.startsAt ?? null,
      };
    }
    const m = p.meta as ListingMeta;
    return {
      id: p.id,
      kind: 'listing',
      lat: p.lat,
      lng: p.lng,
      createdAt: m.createdAt ?? null,
      mode: m.mode,
    };
  }

  private timeKey(p: DiscoveryPoint): number {
    if (p.kind === 'cluster') return 0;
    if (p.kind === 'user') return 0;
    if (p.kind === 'event') {
      const t = (p.meta as EventMeta).startsAt;
      return t ? new Date(t).getTime() : 0;
    }
    const t = (p.meta as ListingMeta).createdAt;
    return t ? new Date(t).getTime() : 0;
  }

  private hashViewport(
    viewport: Viewport,
    zoom: number,
    kinds: EntityKind[],
    topicSlug: string | undefined,
    listingMode: ListingMode | undefined,
    friendsOnly: boolean,
    rankBy: DiscoveryRankBy,
  ): string {
    const payload = JSON.stringify({
      viewport,
      zoom,
      kinds: [...kinds].sort(),
      topicSlug: topicSlug ?? null,
      listingMode: listingMode ?? null,
      friendsOnly,
      rankBy,
    });
    return createHash('sha256').update(payload).digest('hex').slice(0, 32);
  }

  private async storeSnapshot(hash: string, points: DiscoveryPoint[]): Promise<void> {
    await this.redis.set(
      `discovery:snap:${hash}`,
      JSON.stringify(points),
      'EX',
      SNAPSHOT_TTL_SECONDS,
    );
  }

  private async computeDiff(
    prevHash: string,
    next: DiscoveryPoint[],
  ): Promise<DiscoveryDiff | null> {
    const raw = await this.redis.get(`discovery:snap:${prevHash}`);
    if (!raw) return null;
    let prev: DiscoveryPoint[];
    try {
      prev = JSON.parse(raw) as DiscoveryPoint[];
    } catch {
      return null;
    }
    const prevIds = new Set(prev.map((p) => this.pointKey(p)));
    const nextIds = new Set(next.map((p) => this.pointKey(p)));
    const added = next.filter((p) => !prevIds.has(this.pointKey(p)));
    const removed = prev
      .filter((p) => !nextIds.has(this.pointKey(p)))
      .map((p) => this.pointKey(p));
    const changeRatio =
      next.length === 0 ? 1 : (added.length + removed.length) / Math.max(next.length, 1);
    if (changeRatio >= DIFF_FALLBACK_THRESHOLD) return null;
    return { added, removed };
  }

  private pointKey(p: DiscoveryPoint): string {
    if (p.kind === 'cluster') return `cluster:${p.cellId}`;
    return `${p.kind}:${p.id}`;
  }

  private empty(
    resolution: number,
    viewport: Viewport,
    kinds: EntityKind[],
    topicSlug: string | undefined,
    listingMode: ListingMode | undefined,
    friendsOnly: boolean,
    rankBy: DiscoveryRankBy = 'relevance',
  ): DiscoveryResponse {
    const viewportHash = this.hashViewport(
      viewport,
      0,
      kinds,
      topicSlug,
      listingMode,
      friendsOnly,
      rankBy,
    );
    return {
      points: [],
      resolution,
      viewportHash,
      generatedAt: new Date().toISOString(),
    };
  }
}
