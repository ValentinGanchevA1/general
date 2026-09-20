import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { InjectDataSource } from '@nestjs/typeorm';
import { DataSource } from 'typeorm';

import type {
  MutualPreviewFace,
  SuggestionCard,
  SuggestionReason,
  VerificationLevel,
} from '@g88/shared';

const NEAR_M = 2_000;
const CITY_M = 10_000;

@Injectable()
export class FriendsSuggestionsService {
  private readonly logger = new Logger(FriendsSuggestionsService.name);

  constructor(@InjectDataSource() private readonly db: DataSource) {}

  /**
   * Ranked people-you-may-know (Option C).
   *
   * Signals (blended score):
   *   mutual FoF, recent wave (14d), recent chat (30d), proximity (2km/10km),
   *   verification tier, shared interests/goals.
   * Excludes: self, friends, blocks, pending requests, active dismiss/snooze.
   */
  async listSuggestions(actorId: string, limit = 20): Promise<SuggestionCard[]> {
    const take = Math.min(Math.max(limit, 1), 50);

    type Row = {
      user_id: string;
      display_name: string;
      avatar_url: string | null;
      mutual_count: string;
      reason: SuggestionReason;
      distance_m: string | null;
      verification_level: string;
      shared_interests: string;
      rank_score: string;
      is_following: boolean;
      pending_out: boolean;
      pending_in: boolean;
    };

    let rows: Row[];
    try {
      rows = await this.db.query<Row[]>(
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
         dismissed AS (
           SELECT target_id AS uid
             FROM friend_suggestion_dismissals
            WHERE actor_id = $1
              AND (snooze_until IS NULL OR snooze_until > NOW())
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
              AND COALESCE(last_message_at, created_at) > NOW() - interval '30 days'
         ),
         me AS (
           SELECT location, interests, goals, verification_level
             FROM users WHERE id = $1
         ),
         nearby AS (
           SELECT u.id AS uid
             FROM users u, me
            WHERE me.location IS NOT NULL
              AND u.location IS NOT NULL
              AND u.id <> $1
              AND u.deleted_at IS NULL
              AND ST_DWithin(u.location, me.location, $3)
         ),
         seed AS (
           SELECT uid FROM fof
           UNION SELECT uid FROM wave_peers
           UNION SELECT uid FROM chat_peers
           UNION SELECT uid FROM nearby
         ),
         eligible AS (
           SELECT s.uid
             FROM seed s
            WHERE s.uid <> $1
              AND s.uid NOT IN (SELECT uid FROM my_friends)
              AND s.uid NOT IN (SELECT uid FROM blocked)
              AND s.uid NOT IN (SELECT uid FROM pending)
              AND s.uid NOT IN (SELECT uid FROM dismissed)
         ),
         scored AS (
           SELECT e.uid,
                  COALESCE(fof.mutual_count, 0)::int AS mutual_count,
                  CASE WHEN wp.uid IS NOT NULL THEN 1 ELSE 0 END AS wave_boost,
                  CASE WHEN cp.uid IS NOT NULL THEN 1 ELSE 0 END AS chat_boost,
                  CASE
                    WHEN me.location IS NOT NULL AND u.location IS NOT NULL THEN
                      ROUND(ST_Distance(me.location, u.location)::numeric)::int
                    ELSE NULL
                  END AS distance_m,
                  COALESCE(
                    (
                      SELECT COUNT(*)::int
                        FROM unnest(COALESCE(u.interests, ARRAY[]::text[])) i(val)
                       WHERE i.val = ANY (COALESCE(me.interests, ARRAY[]::text[]))
                    ), 0
                  ) AS shared_interests,
                  COALESCE(
                    (
                      SELECT COUNT(*)::int
                        FROM unnest(COALESCE(u.goals, ARRAY[]::text[])) g(val)
                       WHERE g.val = ANY (COALESCE(me.goals, ARRAY[]::text[]))
                    ), 0
                  ) AS shared_goals,
                  u.verification_level,
                  u.display_name,
                  u.avatar_url
             FROM eligible e
             JOIN users u ON u.id = e.uid AND u.deleted_at IS NULL
             CROSS JOIN me
             LEFT JOIN fof ON fof.uid = e.uid
             LEFT JOIN wave_peers wp ON wp.uid = e.uid
             LEFT JOIN chat_peers cp ON cp.uid = e.uid
         ),
         ranked AS (
           SELECT s.*,
                  (
                    3.0 * LN(1 + s.mutual_count) / LN(2)
                    + 2.0 * s.wave_boost
                    + 1.5 * s.chat_boost
                    + CASE
                        WHEN s.distance_m IS NOT NULL AND s.distance_m <= $2 THEN 1.0
                        WHEN s.distance_m IS NOT NULL AND s.distance_m <= $3 THEN 0.5
                        ELSE 0.0
                      END
                    + CASE s.verification_level
                        WHEN 'id' THEN 0.5
                        WHEN 'phone' THEN 0.35
                        WHEN 'email' THEN 0.2
                        ELSE 0.0
                      END
                    + LEAST(s.shared_interests, 5)::float / 5.0
                    + 0.5 * (LEAST(s.shared_goals, 3)::float / 3.0)
                  ) AS rank_score,
                  CASE
                    WHEN s.mutual_count > 0 THEN 'mutual_friends'
                    WHEN s.distance_m IS NOT NULL AND s.distance_m <= $3 THEN 'nearby'
                    WHEN s.wave_boost = 1 THEN 'recent_wave'
                    WHEN s.chat_boost = 1 THEN 'recent_chat'
                    WHEN s.shared_interests > 0 THEN 'shared_interests'
                    ELSE 'nearby'
                  END AS reason
             FROM scored s
         )
         SELECT r.uid AS user_id,
                r.display_name,
                r.avatar_url,
                r.mutual_count::text AS mutual_count,
                r.reason,
                r.distance_m::text AS distance_m,
                r.verification_level,
                r.shared_interests::text AS shared_interests,
                r.rank_score::text AS rank_score,
                EXISTS (
                  SELECT 1 FROM follows fl
                   WHERE fl.follower_id = $1 AND fl.followee_id = r.uid
                ) AS is_following,
                EXISTS (
                  SELECT 1 FROM friend_requests fr
                   WHERE fr.status = 'pending'
                     AND fr.requester_id = $1 AND fr.addressee_id = r.uid
                ) AS pending_out,
                EXISTS (
                  SELECT 1 FROM friend_requests fr
                   WHERE fr.status = 'pending'
                     AND fr.requester_id = r.uid AND fr.addressee_id = $1
                ) AS pending_in
           FROM ranked r
          ORDER BY r.rank_score DESC, r.mutual_count DESC, r.display_name ASC
          LIMIT $4`,
        [actorId, NEAR_M, CITY_M, take],
      );
    } catch (err) {
      this.logger.error(
        `listSuggestions failed for ${actorId}: ${err instanceof Error ? err.message : String(err)}`,
      );
      return [];
    }

    const ids = rows.map((r) => r.user_id);
    const previews = await this.loadMutualPreviews(actorId, ids);

    return rows.map((r) => {
      const card: SuggestionCard = {
        userId: r.user_id,
        displayName: r.display_name,
        avatarUrl: r.avatar_url,
        mutualFriendsCount: Number(r.mutual_count),
        reason: r.reason,
        isFollowing: Boolean(r.is_following),
        hasPendingOutgoing: Boolean(r.pending_out),
        hasPendingIncoming: Boolean(r.pending_in),
      };
      const preview = previews.get(r.user_id);
      if (preview && preview.length > 0) card.mutualPreview = preview;
      if (r.distance_m != null) card.distanceMeters = Number(r.distance_m);
      card.verification = r.verification_level as VerificationLevel;
      const shared = Number(r.shared_interests);
      if (shared > 0) card.sharedInterestsCount = shared;
      card.rankScore = Number(r.rank_score);
      return card;
    });
  }

  /**
   * Permanent dismiss (snoozeUntil null) or temporary snooze.
   * Upserts so re-dismiss refreshes the window.
   */
  async dismissSuggestion(
    actorId: string,
    targetId: string,
    opts: { snoozeUntil?: Date | null; snoozeDays?: number } = {},
  ): Promise<{ ok: true }> {
    if (actorId === targetId) {
      return { ok: true };
    }

    const exists = await this.db.query<Array<{ id: string }>>(
      `SELECT id FROM users WHERE id = $1 AND deleted_at IS NULL LIMIT 1`,
      [targetId],
    );
    if (exists.length === 0) {
      throw new NotFoundException({ code: 'user.not_found', message: 'User not found' });
    }

    let snoozeUntil: Date | null = null;
    if (opts.snoozeUntil instanceof Date) {
      snoozeUntil = opts.snoozeUntil;
    } else if (typeof opts.snoozeDays === 'number' && opts.snoozeDays > 0) {
      const days = Math.min(Math.max(Math.floor(opts.snoozeDays), 1), 30);
      snoozeUntil = new Date(Date.now() + days * 86_400_000);
    } else if (opts.snoozeUntil === null || opts.snoozeUntil === undefined) {
      snoozeUntil = null; // permanent
    }

    await this.db.query(
      `INSERT INTO friend_suggestion_dismissals (actor_id, target_id, dismissed_at, snooze_until)
       VALUES ($1, $2, NOW(), $3)
       ON CONFLICT (actor_id, target_id) DO UPDATE
         SET dismissed_at = NOW(),
             snooze_until = EXCLUDED.snooze_until`,
      [actorId, targetId, snoozeUntil],
    );

    return { ok: true };
  }

  /** Up to 3 mutual friends per candidate for avatar stack. */
  private async loadMutualPreviews(
    actorId: string,
    candidateIds: string[],
  ): Promise<Map<string, MutualPreviewFace[]>> {
    const out = new Map<string, MutualPreviewFace[]>();
    if (candidateIds.length === 0) return out;

    type PreviewRow = {
      candidate_id: string;
      user_id: string;
      display_name: string;
      avatar_url: string | null;
      rn: string;
    };

    let rows: PreviewRow[];
    try {
      rows = await this.db.query<PreviewRow[]>(
        `WITH my_friends AS (
           SELECT CASE WHEN user_low_id = $1 THEN user_high_id ELSE user_low_id END AS uid
             FROM friendships WHERE user_low_id = $1 OR user_high_id = $1
         ),
         their_friends AS (
           SELECT c.cid AS candidate_id,
                  CASE WHEN f.user_low_id = c.cid THEN f.user_high_id ELSE f.user_low_id END AS uid
             FROM unnest($2::uuid[]) AS c(cid)
             JOIN friendships f
               ON f.user_low_id = c.cid OR f.user_high_id = c.cid
         ),
         mutual AS (
           SELECT tf.candidate_id, tf.uid
             FROM their_friends tf
             JOIN my_friends mf ON mf.uid = tf.uid
         ),
         ranked AS (
           SELECT m.candidate_id,
                  u.id AS user_id,
                  u.display_name,
                  u.avatar_url,
                  ROW_NUMBER() OVER (
                    PARTITION BY m.candidate_id ORDER BY u.display_name ASC
                  ) AS rn
             FROM mutual m
             JOIN users u ON u.id = m.uid AND u.deleted_at IS NULL
         )
         SELECT candidate_id, user_id, display_name, avatar_url, rn::text
           FROM ranked
          WHERE rn <= 3`,
        [actorId, candidateIds],
      );
    } catch (err) {
      this.logger.warn(
        `loadMutualPreviews failed: ${err instanceof Error ? err.message : String(err)}`,
      );
      return out;
    }

    for (const r of rows) {
      const list = out.get(r.candidate_id) ?? [];
      list.push({
        userId: r.user_id,
        displayName: r.display_name,
        avatarUrl: r.avatar_url,
      });
      out.set(r.candidate_id, list);
    }
    return out;
  }
}
