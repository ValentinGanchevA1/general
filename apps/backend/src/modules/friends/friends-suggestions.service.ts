import { Injectable } from '@nestjs/common';
import { InjectDataSource } from '@nestjs/typeorm';
import { DataSource } from 'typeorm';

import type { SuggestionCard, SuggestionReason } from '@g88/shared';

@Injectable()
export class FriendsSuggestionsService {
  constructor(@InjectDataSource() private readonly db: DataSource) {}

  /**
   * Ranked people-you-may-know.
   * Sources: friends-of-friends (mutual count), recent waves (14d), recent chat peers.
   * Excludes: self, blocked either way, existing friends, pending requests either way.
   */
  async listSuggestions(actorId: string, limit = 20): Promise<SuggestionCard[]> {
    const take = Math.min(Math.max(limit, 1), 50);

    const rows = await this.db.query<
      Array<{
        user_id: string;
        display_name: string;
        avatar_url: string | null;
        mutual_count: string;
        reason: SuggestionReason;
        is_following: boolean;
        pending_out: boolean;
        pending_in: boolean;
      }>
    >(
      `WITH blocked AS (
         SELECT blocked_id AS uid FROM user_blocks WHERE blocker_id = $1
         UNION
         SELECT blocker_id AS uid FROM user_blocks WHERE blocked_id = $1
       ),
       my_friends AS (
         SELECT CASE WHEN user_low_id = $1 THEN user_high_id ELSE user_low_id END AS uid
           FROM friendships WHERE user_low_id = $1 OR user_high_id = $1
       ),
       pending AS (
         SELECT CASE WHEN requester_id = $1 THEN addressee_id ELSE requester_id END AS uid
           FROM friend_requests
          WHERE status = 'pending'
            AND (requester_id = $1 OR addressee_id = $1)
       ),
       fof AS (
         SELECT CASE WHEN f.user_low_id = mf.uid THEN f.user_high_id ELSE f.user_low_id END AS uid,
                COUNT(*)::int AS mutual_count
           FROM my_friends mf
           JOIN friendships f
             ON (f.user_low_id = mf.uid OR f.user_high_id = mf.uid)
          GROUP BY 1
       ),
       wave_peers AS (
         SELECT CASE WHEN from_user_id = $1 THEN to_user_id ELSE from_user_id END AS uid
           FROM waves
          WHERE (from_user_id = $1 OR to_user_id = $1)
            AND created_at > NOW() - interval '14 days'
       ),
       chat_peers AS (
         SELECT unnest(participant_ids) AS uid
           FROM conversations
          WHERE $1 = ANY (participant_ids)
            AND status = 'accepted'
            AND COALESCE(updated_at, created_at) > NOW() - interval '30 days'
       ),
       candidates AS (
         SELECT uid, mutual_count, 'mutual_friends'::text AS reason, 0 AS rank_tier
           FROM fof WHERE mutual_count > 0
         UNION ALL
         SELECT uid, 0, 'recent_wave'::text, 1 FROM wave_peers
         UNION ALL
         SELECT uid, 0, 'recent_chat'::text, 2 FROM chat_peers
       ),
       ranked AS (
         SELECT c.uid,
                MAX(c.mutual_count) AS mutual_count,
                MIN(c.rank_tier) AS rank_tier,
                (ARRAY_AGG(c.reason ORDER BY c.rank_tier))[1] AS reason
           FROM candidates c
          WHERE c.uid <> $1
            AND c.uid NOT IN (SELECT uid FROM my_friends)
            AND c.uid NOT IN (SELECT uid FROM blocked)
            AND c.uid NOT IN (SELECT uid FROM pending)
          GROUP BY c.uid
       )
       SELECT u.id AS user_id,
              u.display_name,
              u.avatar_url,
              r.mutual_count::text AS mutual_count,
              r.reason,
              EXISTS (
                SELECT 1 FROM follows fl
                 WHERE fl.follower_id = $1 AND fl.followee_id = u.id
              ) AS is_following,
              false AS pending_out,
              false AS pending_in
         FROM ranked r
         JOIN users u ON u.id = r.uid AND u.deleted_at IS NULL
        ORDER BY r.rank_tier ASC, r.mutual_count DESC, u.display_name ASC
        LIMIT $2`,
      [actorId, take],
    );

    return rows.map((r) => ({
      userId: r.user_id,
      displayName: r.display_name,
      avatarUrl: r.avatar_url,
      mutualFriendsCount: Number(r.mutual_count),
      reason: r.reason,
      isFollowing: r.is_following,
      hasPendingOutgoing: r.pending_out,
      hasPendingIncoming: r.pending_in,
    }));
  }
}
