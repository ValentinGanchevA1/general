import { BadRequestException, Injectable } from '@nestjs/common';
import { InjectDataSource } from '@nestjs/typeorm';
import { DataSource } from 'typeorm';

import type { FriendListMetaItem, FriendListMetaResponse } from '@g88/shared';

const MAX_IDS = 100;
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

@Injectable()
export class FriendsListMetaService {
  constructor(@InjectDataSource() private readonly db: DataSource) {}

  async getListMeta(viewerId: string, userIdsRaw: string): Promise<FriendListMetaResponse> {
    const rawIds = userIdsRaw
      .split(',')
      .map((id) => id.trim())
      .filter(Boolean);

    if (rawIds.length > MAX_IDS) {
      throw new BadRequestException({
        code: 'friends.list_meta.too_many_ids',
        message: `At most ${MAX_IDS} user ids are allowed.`,
      });
    }

    if (rawIds.some((id) => !UUID_RE.test(id))) {
      throw new BadRequestException({
        code: 'friends.list_meta.invalid_id',
        message: 'One or more user ids are invalid.',
      });
    }

    const userIds = [...new Set(rawIds)].filter((id) => id !== viewerId);
    if (userIds.length === 0) return { items: [] };

    type Row = {
      user_id: string;
      mutual_count: number | string;
      distance_m: number | string | null;
    };

    const rows = await this.db.query<Row[]>(
      `WITH requested AS (
         SELECT unnest($2::uuid[]) AS uid
       ),
       my_friends AS (
         SELECT CASE
                  WHEN user_low_id = $1 THEN user_high_id
                  ELSE user_low_id
                END AS uid
           FROM friendships
          WHERE user_low_id = $1 OR user_high_id = $1
       ),
       their_friends AS (
         SELECT r.uid AS target_id,
                CASE
                  WHEN f.user_low_id = r.uid THEN f.user_high_id
                  ELSE f.user_low_id
                END AS friend_id
           FROM requested r
           JOIN friendships f
             ON f.user_low_id = r.uid OR f.user_high_id = r.uid
       ),
       mutual_counts AS (
         SELECT tf.target_id, COUNT(*)::int AS mutual_count
           FROM their_friends tf
           JOIN my_friends mf ON mf.uid = tf.friend_id
          GROUP BY tf.target_id
       )
       SELECT r.uid AS user_id,
              COALESCE(mc.mutual_count, 0)::int AS mutual_count,
              CASE
                WHEN me.location IS NOT NULL AND u.location IS NOT NULL THEN
                  ROUND(ST_Distance(me.location, u.location)::numeric)::int
                ELSE NULL
              END AS distance_m
         FROM requested r
         JOIN users u ON u.id = r.uid AND u.deleted_at IS NULL
         JOIN users me ON me.id = $1 AND me.deleted_at IS NULL
         LEFT JOIN mutual_counts mc ON mc.target_id = r.uid
        WHERE (
          EXISTS (
            SELECT 1
              FROM friendships f
             WHERE (f.user_low_id = $1 AND f.user_high_id = r.uid)
                OR (f.user_high_id = $1 AND f.user_low_id = r.uid)
          )
          OR EXISTS (
            SELECT 1
              FROM follows fl
             WHERE (fl.follower_id = $1 AND fl.followee_id = r.uid)
                OR (fl.followee_id = $1 AND fl.follower_id = r.uid)
          )
        )
          AND NOT EXISTS (
            SELECT 1
              FROM user_blocks b
             WHERE (b.blocker_id = $1 AND b.blocked_id = r.uid)
                OR (b.blocked_id = $1 AND b.blocker_id = r.uid)
          )`,
      [viewerId, userIds],
    );

    const items: FriendListMetaItem[] = rows.map((row) => {
      const meters = row.distance_m == null ? null : Number(row.distance_m);
      return {
        userId: row.user_id,
        mutualFriendsCount: Number(row.mutual_count),
        // Match PublicUserProfile privacy: kilometer buckets only.
        distanceMeters: meters == null ? null : Math.round(meters / 1000) * 1000,
      };
    });

    return { items };
  }
}
