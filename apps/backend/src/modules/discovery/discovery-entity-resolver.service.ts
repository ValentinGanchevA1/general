import { Injectable } from '@nestjs/common';
import { InjectDataSource } from '@nestjs/typeorm';
import { DataSource } from 'typeorm';

import type { DiscoveryPoint, EntityKind, UserMeta } from '@g88/shared';

import { FriendsService } from '../friends/friends.service';
import { PresenceService } from '../presence/presence.service';

type DiscoverableKind = Exclude<EntityKind, 'cluster'>;

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

/**
 * Resolves one realtime discovery entity through the same viewer-facing privacy
 * boundary used by discovery: public visibility, self exclusion, bilateral
 * blocks, and friend-only presence enrichment.
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
  }): Promise<DiscoveryPoint | null> {
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
          )
        LIMIT 1`,
      [params.entityId, params.kind, params.viewerId],
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

    const friendIds = await this.friends.listFriendIds(params.viewerId);
    const isFriend = friendIds.includes(row.id);
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
