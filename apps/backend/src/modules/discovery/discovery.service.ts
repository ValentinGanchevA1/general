import { Inject, Injectable, Logger } from '@nestjs/common';
import { InjectDataSource } from '@nestjs/typeorm';
import { DataSource } from 'typeorm';
import { createHash } from 'node:crypto';
import * as h3 from 'h3-js';
import type Redis from 'ioredis';

import {
  type DiscoveryRankBy,
  type DiscoveryResponse,
  type DiscoveryPoint,
  type EntityKind,
  type ListingMode,
  type MarketplaceKind,
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
import { buildDiscoveryDiffFromSnapshot } from './discoveryDiff';
import {
  computeRankScore,
  haversineM,
  type RankableEntity,
  type RankContext,
} from './ranking/scoring';

const DEFAULT_KINDS: EntityKind[] = ['user', 'event', 'listing'];
const MAX_POINTS_PER_RESPONSE = 500;
const MAX_CELLS_PER_VIEWPORT = 5_000;
const ESTIMATE_CELL_MARGIN = 0.8;
const H3_CELL_AREA_KM2: Record<number, number> = {
  4: 1770.3, 5: 252.9, 6: 36.13, 7: 5.161, 8: 0.7373, 9: 0.1053, 10: 0.01504,
};
const SNAPSHOT_TTL_SECONDS = 30;

function listingModeSql(mode: ListingMode | undefined): string {
  if (mode === 'buy') return `AND (kind <> 'listing' OR meta->>'mode' = 'buy')`;
  if (mode === 'sell') return `AND (kind <> 'listing' OR COALESCE(meta->>'mode', 'sell') = 'sell')`;
  return '';
}

function marketplaceKindSql(kind: MarketplaceKind | undefined): string {
  if (kind === undefined) return '';
  const literal = (() => {
    switch (kind) {
      case 'for_sale': return 'for_sale';
      case 'service': return 'service';
      case 'job': return 'job';
      case 'local_deal': return 'local_deal';
    }
  })();
  return `AND (kind <> 'listing' OR (
    COALESCE(meta->>'mode', 'sell') = 'sell'
    AND COALESCE(meta->>'marketplaceKind', 'for_sale') = '${literal}'
  ))`;
}

const TOPIC_MATCH_SQL = (param: string): string =>
  `((kind = 'event'   AND g88_slugify(meta->>'title')    = ${param})
 OR (kind = 'listing' AND g88_slugify(meta->>'category') = ${param}))`;

const DISCOVERY_OWNER_ID_SQL = `CASE v_discoverable_entity.kind
  WHEN 'user' THEN v_discoverable_entity.id
  WHEN 'event' THEN NULLIF(v_discoverable_entity.meta->>'hostId', '')::uuid
  WHEN 'listing' THEN NULLIF(v_discoverable_entity.meta->>'sellerId', '')::uuid
  ELSE NULL
END`;

function blockIsolationSql(requesterParam: string): string {
  return `AND NOT EXISTS (
           SELECT 1
             FROM user_blocks ub
            WHERE (ub.blocker_id = ${requesterParam}
                   AND ub.blocked_id = (${DISCOVERY_OWNER_ID_SQL}))
               OR (ub.blocker_id = (${DISCOVERY_OWNER_ID_SQL})
                   AND ub.blocked_id = ${requesterParam})
         )`;
}

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
    marketplaceKind?: MarketplaceKind;
    friendsOnly?: boolean;
    datingOnly?: boolean;
    rankBy?: DiscoveryRankBy;
  }): Promise<DiscoveryResponse> {
    const friendsOnly = params.friendsOnly === true;
    /** Dating mode wins only when friends-only is off. */
    const datingOnly = params.datingOnly === true && !friendsOnly;
    const rankBy: DiscoveryRankBy = params.rankBy ?? 'relevance';
    const topicSlug = friendsOnly
      ? ''
      : params.topic
        ? params.topic.replace(/^#/, '').trim().toLowerCase()
        : '';
    const requested = params.kinds?.length ? params.kinds : DEFAULT_KINDS;
    let kinds = topicSlug
      ? requested.filter((k) => k === 'event' || k === 'listing')
      : requested;
    if (friendsOnly || datingOnly) kinds = ['user'];
    const listingMode: ListingMode | undefined =
      friendsOnly || datingOnly
        ? undefined
        : params.listingMode === 'buy' || params.listingMode === 'sell'
          ? params.listingMode
          : undefined;
    const marketplaceKind: MarketplaceKind | undefined =
      friendsOnly || datingOnly || listingMode === 'buy'
        ? undefined
        : params.marketplaceKind;
    const friendIds = friendsOnly
      ? await this.friends.listFriendIds(params.requesterId)
      : null;

    if (datingOnly) {
      const openRows = await this.db.query<Array<{ open_to_dating: boolean }>>(
        `SELECT COALESCE(open_to_dating, false) AS open_to_dating
           FROM users WHERE id = $1 AND deleted_at IS NULL LIMIT 1`,
        [params.requesterId],
      );
      if (!openRows[0]?.open_to_dating) {
        return this.empty(
          h3ResolutionForZoom(params.zoom),
          params.viewport,
          kinds,
          '',
          undefined,
          undefined,
          false,
          rankBy,
          true,
        );
      }
    }
    const resolution = h3ResolutionForZoom(params.zoom);

    if (friendsOnly && (friendIds == null || friendIds.length === 0)) {
      return this.empty(
        resolution,
        params.viewport,
        kinds,
        topicSlug,
        listingMode,
        marketplaceKind,
        true,
        rankBy,
        datingOnly,
      );
    }

    const estimate = this.estimateCellCount(params.viewport, resolution);
    if (estimate > MAX_CELLS_PER_VIEWPORT * ESTIMATE_CELL_MARGIN) {
      this.logger.warn(
        `Viewport estimate ${estimate} cells at r${resolution} — refusing before polygonToCells`,
      );
      return this.empty(
        resolution,
        params.viewport,
        kinds,
        topicSlug,
        listingMode,
        marketplaceKind,
        friendsOnly,
        rankBy,
        datingOnly,
      );
    }

    const cells = cellsForViewport(params.viewport, resolution);
    if (cells.length === 0 || (topicSlug && kinds.length === 0)) {
      return this.empty(
        resolution,
        params.viewport,
        kinds,
        topicSlug,
        listingMode,
        marketplaceKind,
        friendsOnly,
        rankBy,
        datingOnly,
      );
    }
    if (cells.length > MAX_CELLS_PER_VIEWPORT) {
      this.logger.warn(`Viewport produced ${cells.length} cells at r${resolution} — refusing`);
      return this.empty(
        resolution,
        params.viewport,
        kinds,
        topicSlug,
        listingMode,
        marketplaceKind,
        friendsOnly,
        rankBy,
        datingOnly,
      );
    }

    const points = isEntityZoom(params.zoom)
      ? await this.entitiesInCells(
          cells,
          resolution,
          kinds,
          params.requesterId,
          topicSlug,
          listingMode,
          marketplaceKind,
          friendIds,
          datingOnly,
          params.viewport,
          rankBy,
        )
      : await this.clusterByCell(
          cells,
          resolution,
          kinds,
          params.requesterId,
          topicSlug,
          listingMode,
          marketplaceKind,
          friendIds,
          datingOnly,
        );

    const viewportHash = this.hashViewport(
      params.viewport,
      params.zoom,
      kinds,
      topicSlug,
      listingMode,
      marketplaceKind,
      friendsOnly,
      rankBy,
      datingOnly,
    );
    await this.storeSnapshot(params.requesterId, viewportHash, points);

    if (params.prevViewportHash) {
      const rawSnapshot = await this.redis.get(
        this.snapshotKey(params.requesterId, params.prevViewportHash),
      );
      const diff = rawSnapshot === null
        ? null
        : buildDiscoveryDiffFromSnapshot(rawSnapshot, points);
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

  private snapshotKey(requesterId: string, hash: string): string {
    return `discovery:snap:${requesterId}:${hash}`;
  }

  private async storeSnapshot(
    requesterId: string,
    hash: string,
    points: DiscoveryPoint[],
  ): Promise<void> {
    await this.redis.set(
      this.snapshotKey(requesterId, hash),
      JSON.stringify(points),
      'EX',
      SNAPSHOT_TTL_SECONDS,
    );
  }

  private async clusterByCell(
    cells: string[],
    resolution: number,
    kinds: EntityKind[],
    requesterId: string,
    topicSlug: string,
    listingMode?: ListingMode,
    marketplaceKind?: MarketplaceKind,
    friendIds: string[] | null = null,
    datingOnly = false,
  ): Promise<DiscoveryPoint[]> {
    const cellCol = this.cellColumn(resolution);
    const listingClause = listingModeSql(listingMode);
    const marketplaceClause = marketplaceKindSql(marketplaceKind);
    const queryParams: unknown[] = [cells, kinds, requesterId];
    let friendsClause = '';
    if (friendIds != null) {
      queryParams.push(friendIds);
      friendsClause = `AND id = ANY($${queryParams.length}::uuid[])`;
    }
    let datingClause = '';
    if (datingOnly) {
      datingClause = `AND kind = 'user' AND EXISTS (
           SELECT 1 FROM users du
            WHERE du.id = v_discoverable_entity.id
              AND du.open_to_dating = true
              AND du.deleted_at IS NULL
         )`;
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
         ${blockIsolationSql('$3')}
         ${topicClause}
         ${listingClause}
         ${marketplaceClause}
         ${friendsClause}
         ${datingClause}
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
    listingMode: ListingMode | undefined,
    marketplaceKind: MarketplaceKind | undefined,
    friendIds: string[] | null,
    datingOnly: boolean,
    viewport: Viewport,
    rankBy: DiscoveryRankBy,
  ): Promise<DiscoveryPoint[]> {
    const cellCol = this.cellColumn(resolution);
    const listingClause = listingModeSql(listingMode);
    const marketplaceClause = marketplaceKindSql(marketplaceKind);
    const centreLat = (viewport.ne.lat + viewport.sw.lat) / 2;
    const centreLng = (viewport.ne.lng + viewport.sw.lng) / 2;
    // Rank candidate IDs before loading full metadata or applying the 500-point cap.
    // Candidate projection deliberately excludes full profile/event/listing JSON.
    const queryParams: unknown[] = [cells, kinds, requesterId];
    let friendsClause = '';
    if (friendIds != null) {
      queryParams.push(friendIds);
      friendsClause = `AND id = ANY($${queryParams.length}::uuid[])`;
    }
    let datingClause = '';
    if (datingOnly) {
      datingClause = `AND kind = 'user' AND EXISTS (
           SELECT 1 FROM users du
            WHERE du.id = v_discoverable_entity.id
              AND du.open_to_dating = true
              AND du.deleted_at IS NULL
         )`;
    }
    let topicClause = '';
    if (topicSlug) {
      queryParams.push(topicSlug);
      topicClause = `AND ${TOPIC_MATCH_SQL('$' + String(queryParams.length))}`;
    }

    const baseWhere = `
        FROM v_discoverable_entity
       WHERE ${cellCol} = ANY($1::text[])
         AND kind = ANY($2::text[])
         AND visibility = 'public'
         AND id <> $3
         ${blockIsolationSql('$3')}
         ${topicClause}
         ${listingClause}
         ${marketplaceClause}
         ${friendsClause}
         ${datingClause}
    `;
    const latSql = "ST_Y(CASE WHEN kind = 'user' THEN ST_SnapToGrid(location::geometry, 0.02) ELSE location::geometry END)";
    const lngSql = "ST_X(CASE WHEN kind = 'user' THEN ST_SnapToGrid(location::geometry, 0.02) ELSE location::geometry END)";
    let selectedFilter = '';

    if (rankBy === 'relevance') {
      const candidateRows = await this.db.query<RankingCandidateRow[]>(
        `SELECT id, kind,
                ${latSql} AS lat,
                ${lngSql} AS lng,
                meta->>'verification' AS verification,
                meta->>'startsAt' AS starts_at,
                meta->>'createdAt' AS created_at,
                meta->>'mode' AS listing_mode
           ${baseWhere}`,
        queryParams,
      );
      const eligible = datingOnly
        ? await this.filterMutualDatingRows(candidateRows, requesterId)
        : candidateRows;
      if (eligible.length === 0) return [];

      // Presence is consulted only for friends who opted in to sharing it.
      const candidateUsers = eligible.filter((row) => row.kind === 'user');
      const allFriendIds = candidateUsers.length
        ? (friendIds ?? await this.friends.listFriendIds(requesterId))
        : [];
      const friendSet = new Set(allFriendIds);
      const eligibleFriendIds = candidateUsers
        .filter((row) => friendSet.has(row.id))
        .map((row) => row.id);
      const permissioned = eligibleFriendIds.length
        ? await this.friends.listWhoAllowFriendsOnline(eligibleFriendIds)
        : new Set<string>();
      const presenceIds = eligibleFriendIds.filter((id) => permissioned.has(id));
      const online = presenceIds.length
        ? await this.presence.whichAreOnline(presenceIds)
        : new Set<string>();
      const lastSeen = presenceIds.length
        ? await this.presence.lastSeenMap(presenceIds)
        : new Map<string, string>();

      const ctx: RankContext = {
        viewerLat: centreLat,
        viewerLng: centreLng,
        viewerId: requesterId,
      };
      const rankedKeys = eligible.map((row) => {
        const isFriend = row.kind === 'user' && friendSet.has(row.id);
        const canShowPresence = isFriend && permissioned.has(row.id);
        const rankable: RankableEntity = {
          id: row.id,
          kind: row.kind,
          lat: row.lat,
          lng: row.lng,
          verification: row.kind === 'user' ? (row.verification ?? undefined) : undefined,
          isFriend,
          online: canShowPresence && online.has(row.id),
          lastSeenAt: canShowPresence ? (lastSeen.get(row.id) ?? null) : null,
          startsAt: row.kind === 'event' ? row.starts_at : undefined,
          createdAt: row.kind === 'listing' ? row.created_at : undefined,
          mode: row.kind === 'listing' ? row.listing_mode : undefined,
        };
        return {
          key: `${row.kind}:${row.id}`,
          score: computeRankScore(rankable, ctx),
        };
      });
      rankedKeys.sort((a, b) => b.score - a.score || a.key.localeCompare(b.key));
      const selectedKeys = rankedKeys
        .slice(0, MAX_POINTS_PER_RESPONSE)
        .map((row) => row.key);
      queryParams.push(selectedKeys);
      selectedFilter = `AND (kind::text || ':' || id::text) = ANY($${queryParams.length}::text[])`;
    }

    let orderClause = 'ORDER BY kind ASC, id ASC';
    if (rankBy === 'distance') {
      const lngIdx = queryParams.length + 1;
      const latIdx = queryParams.length + 2;
      queryParams.push(centreLng, centreLat);
      orderClause = `ORDER BY location::geography <-> ST_SetSRID(ST_MakePoint($${lngIdx}, $${latIdx}), 4326)::geography, kind ASC, id ASC`;
    } else if (rankBy === 'newest') {
      // Creation/start timestamps in discovery meta are canonical ISO-8601 UTC strings.
      orderClause = `ORDER BY CASE
        WHEN kind = 'event' THEN meta->>'startsAt'
        WHEN kind = 'listing' THEN meta->>'createdAt'
        ELSE NULL END DESC NULLS LAST, kind ASC, id ASC`;
    }
    queryParams.push(MAX_POINTS_PER_RESPONSE);
    const rows: EntityRow[] = await this.db.query(
      `
      SELECT id, kind,
             ${latSql} AS lat,
             ${lngSql} AS lng,
             meta
      ${baseWhere}
        ${selectedFilter}
      ${orderClause}
       LIMIT $${queryParams.length}
      `,
      queryParams,
    );

    let filteredRows = rows;
    if (datingOnly) {
      const userIdsForDating = rows.filter((r) => r.kind === 'user').map((r) => r.id);
      if (userIdsForDating.length > 0) {
        const prefRows = await this.db.query<
          Array<{
            id: string;
            gender: string | null;
            seeking_genders: string[] | null;
          }>
        >(
          `SELECT id, gender, COALESCE(seeking_genders, '{}') AS seeking_genders
             FROM users
            WHERE id = ANY($1::uuid[]) OR id = $2`,
          [userIdsForDating, requesterId],
        );
        const byId = new Map(prefRows.map((p) => [p.id, p]));
        const viewer = byId.get(requesterId);
        const viewerGender = viewer?.gender ?? null;
        const viewerSeeking = Array.isArray(viewer?.seeking_genders)
          ? viewer!.seeking_genders.filter((g): g is string => typeof g === 'string')
          : [];
        filteredRows = rows.filter((r) => {
          if (r.kind !== 'user') return false;
          const c = byId.get(r.id);
          if (!c) return false;
          const candidateSeeking = Array.isArray(c.seeking_genders)
            ? c.seeking_genders.filter((g): g is string => typeof g === 'string')
            : [];
          if (viewerSeeking.length > 0 && c.gender != null && !viewerSeeking.includes(c.gender)) {
            return false;
          }
          if (
            candidateSeeking.length > 0 &&
            viewerGender != null &&
            !candidateSeeking.includes(viewerGender)
          ) {
            return false;
          }
          return true;
        });
      } else {
        filteredRows = [];
      }
    }
    const userIds = filteredRows.filter((r) => r.kind === 'user').map((r) => r.id);
    const friendIdSet =
      userIds.length > 0
        ? new Set(await this.friends.listFriendIds(requesterId))
        : new Set<string>();
    const friendUserIds = userIds.filter((id) => friendIdSet.has(id));
    const allowOnlineSet =
      friendUserIds.length > 0
        ? await this.friends.listWhoAllowFriendsOnline(friendUserIds)
        : new Set<string>();
    const presenceIds = friendUserIds.filter((id) => allowOnlineSet.has(id));
    const onlineSet = presenceIds.length
      ? await this.presence.whichAreOnline(presenceIds)
      : new Set<string>();
    const lastSeen =
      presenceIds.length > 0
        ? await this.presence.lastSeenMap(presenceIds)
        : new Map<string, string>();

    let points: DiscoveryPoint[] = filteredRows.map((r) => {
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
        return this.timeKey(b) - this.timeKey(a);
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

  /**
   * Mutual dating eligibility must be applied before relevance top-K; filtering
   * only the hydrated 500 would hide valid lower-ranked matches.
   */
  private async filterMutualDatingRows<T extends { id: string; kind: EntityKind }>(
    rows: T[],
    requesterId: string,
  ): Promise<T[]> {
    const candidateIds = rows.filter((row) => row.kind === 'user').map((row) => row.id);
    if (candidateIds.length === 0) return [];
    const prefRows = await this.db.query<Array<{
      id: string;
      gender: string | null;
      seeking_genders: string[] | null;
    }>>(
      `SELECT id, gender, COALESCE(seeking_genders, '{}') AS seeking_genders
         FROM users
        WHERE id = ANY($1::uuid[]) OR id = $2`,
      [candidateIds, requesterId],
    );
    const byId = new Map(prefRows.map((person) => [person.id, person]));
    const viewer = byId.get(requesterId);
    const viewerGender = viewer?.gender ?? null;
    const viewerSeeking = viewer?.seeking_genders ?? [];
    return rows.filter((row) => {
      if (row.kind !== 'user') return false;
      const candidate = byId.get(row.id);
      if (!candidate) return false;
      const seeking = candidate.seeking_genders ?? [];
      return (viewerSeeking.length === 0 || candidate.gender == null || viewerSeeking.includes(candidate.gender))
        && (seeking.length === 0 || viewerGender == null || seeking.includes(viewerGender));
    });
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
        startsAt: m.startsAt,
      };
    }
    const m = p.meta as ListingMeta;
    return {
      id: p.id,
      kind: 'listing',
      lat: p.lat,
      lng: p.lng,
      mode: m.mode,
      createdAt: m.createdAt ?? null,
    };
  }

  private timeKey(p: DiscoveryPoint): number {
    if (p.kind === 'event') {
      const s = (p.meta as EventMeta).startsAt;
      return s ? new Date(s).getTime() : 0;
    }
    if (p.kind === 'listing') {
      const c = (p.meta as ListingMeta).createdAt;
      return c ? new Date(c).getTime() : 0;
    }
    return 0;
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
    marketplaceKind?: MarketplaceKind,
    friendsOnly = false,
    rankBy: DiscoveryRankBy = 'relevance',
    datingOnly = false,
  ): string {
    return createHash('sha1')
      .update(
        JSON.stringify({
          viewport,
          zoom,
          kinds: [...kinds].sort((a, b) => a.localeCompare(b)),
          topicSlug,
          listingMode: listingMode ?? null,
          marketplaceKind: marketplaceKind ?? null,
          friendsOnly,
          datingOnly,
          rankBy,
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
    marketplaceKind?: MarketplaceKind,
    friendsOnly = false,
    rankBy: DiscoveryRankBy = 'relevance',
    datingOnly = false,
  ): DiscoveryResponse {
    return {
      points: [],
      resolution,
      generatedAt: new Date().toISOString(),
      viewportHash: this.hashViewport(
        viewport,
        0,
        kinds,
        topicSlug,
        listingMode,
        marketplaceKind,
        friendsOnly,
        rankBy,
        datingOnly,
      ),
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

/** Small ranking projection fetched for every authorized candidate, not full meta. */
interface RankingCandidateRow {
  id: string;
  kind: EntityKind;
  lat: number;
  lng: number;
  verification: RankableEntity['verification'] | null;
  starts_at: string | null;
  created_at: string | null;
  listing_mode: ListingMode | undefined;
}
