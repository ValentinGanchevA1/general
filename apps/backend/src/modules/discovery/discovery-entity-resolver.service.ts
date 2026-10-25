import { Injectable } from '@nestjs/common';
import { InjectDataSource } from '@nestjs/typeorm';
import { DataSource } from 'typeorm';

import type {
  DiscoveryPoint,
  DiscoverySubscriptionPayload,
  EntityKind,
  UserMeta,
} from '@g88/shared';

import { FriendsService } from '../friends/friends.service';
import { PresenceService } from '../presence/presence.service';

type DiscoverableKind = EntityKind;

interface EntityRow {
  id: string;
  kind: DiscoverableKind;
  lat: number;
  lng: number;
  meta: unknown;
}

const OWNER_ID_SQL = `CASE v_discoverable_entity.kind
  WHEN 'user' THEN v_discoverable_entity.id
  WHEN 'event' THEN NULLIF(v_discoverable_entity.meta->>'hostId', '')::uuid
  WHEN 'listing' THEN NULLIF(v_discoverable_entity.meta->>'sellerId', '')::uuid
  ELSE NULL
END`;

function contextAllowsKind(
  context: DiscoverySubscriptionPayload,
  kind: DiscoverableKind,
): boolean {
  if (context.topic !== undefined && kind === 'user') return false;
  if ((context.friendsOnly === true || context.datingOnly === true) && kind !== 'user') {
    return false;
  }
  return context.kinds === undefined || context.kinds.includes(kind);
}

function topicSql(param: string): string {
  return `AND ((kind = 'event' AND g88_slugify(meta->>'title') = ${param})
         OR (kind = 'listing' AND g88_slugify(meta->>'category') = ${param}))`;
}

function listingModeSql(param: string): string {
  return `AND (kind <> 'listing' OR COALESCE(meta->>'mode', 'sell') = ${param})`;
}

/**
 * Resolves one realtime discovery entity through the viewer-facing privacy and
 * active-filter boundary. Candidate viewport/entity-zoom gating happens in the
 * subscription store; this resolver re-checks filters that require DB/social state.
 */
@Injectable()
export class DiscoveryEntityResolver {
  constructor(
    @InjectDataSource() private readonly db: DataSource,
    private readonly presence: PresenceService,
    private readonly friends: FriendsService,
  ) {}

  async resolveForViewer(params: {
    viewerId: string;
    kind: DiscoverableKind;
    entityId: string;
    context?: DiscoverySubscriptionPayload;
  }): Promise<DiscoveryPoint | null> {
    const context = params.context;
    if (context !== undefined && !contextAllowsKind(context, params.kind)) return null;

    let friendIds: string[] | null = null;
    if (context?.friendsOnly === true) {
      friendIds = await this.friends.listFriendIds(params.viewerId);
      if (!friendIds.includes(params.entityId)) return null;
    }

    const values: unknown[] = [params.entityId, params.kind, params.viewerId];
    let filters = '';
    if (context?.topic !== undefined) {
      values.push(context.topic);
      filters += `\n          ${topicSql(`$${values.length}`)}`;
    }
    if (context?.listingMode !== undefined) {
      values.push(context.listingMode);
      filters += `\n          ${listingModeSql(`$${values.length}`)}`;
    }
    if (context?.datingOnly === true) {
      filters += `\n          AND kind = 'user'\n          AND COALESCE((meta->>'openToDating')::boolean, false) = true`;
    }

    const rows = await this.db.query<EntityRow[]>(
      `SELECT id, kind,
              ST_Y(location::geometry) AS lat,
              ST_X(location::geometry) AS lng,
              meta
         FROM v_discoverable_entity
        WHERE id = $1
          AND kind = $2
          AND visibility = 'public'
          AND id <> $3
          AND NOT EXISTS (
            SELECT 1
              FROM user_blocks ub
             WHERE (ub.blocker_id = $3 AND ub.blocked_id = (${OWNER_ID_SQL}))
                OR (ub.blocker_id = (${OWNER_ID_SQL}) AND ub.blocked_id = $3)
          )${filters}
        LIMIT 1`,
      values,
    );

    const row = rows[0];
    if (!row) return null;

    if (row.kind !== 'user') {
      return {
        kind: row.kind,
        id: row.id,
        lat: row.lat,
        lng: row.lng,
        meta: row.meta,
      } as DiscoveryPoint;
    }

    const resolvedFriendIds = friendIds ?? (await this.friends.listFriendIds(params.viewerId));
    const isFriend = resolvedFriendIds.includes(row.id);
    let online = false;
    let lastSeenAt: string | null = null;

    if (isFriend) {
      const allowOnline = await this.friends.listWhoAllowFriendsOnline([row.id]);
      if (allowOnline.has(row.id)) {
        const [onlineSet, lastSeen] = await Promise.all([
          this.presence.whichAreOnline([row.id]),
          this.presence.lastSeenMap([row.id]),
        ]);
        online = onlineSet.has(row.id);
        lastSeenAt = lastSeen.get(row.id) ?? null;
      }
    }

    const meta = row.meta as UserMeta;
    return {
      kind: 'user',
      id: row.id,
      lat: row.lat,
      lng: row.lng,
      meta: {
        ...meta,
        online,
        lastSeenAt,
        isFriend,
      },
    };
  }
}
