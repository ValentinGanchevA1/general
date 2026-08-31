import { Injectable, Logger } from '@nestjs/common';
import { ModuleRef } from '@nestjs/core';
import { InjectDataSource } from '@nestjs/typeorm';
import { DataSource } from 'typeorm';

import {
  type GamificationSummary,
  type LeaderboardEntry,
  type LeaderboardPage,
  type LeaderboardScope,
  type LevelUpEvent,
  type XpReason,
  XP_AMOUNTS,
  XP_DAILY_CAP,
  levelForXp,
  summaryForXp,
  xpForLevel,
} from '@g88/shared';

import { RealtimeGateway } from '../../realtime/realtime.gateway';

@Injectable()
export class GamificationService {
  private readonly logger = new Logger(GamificationService.name);

  constructor(
    @InjectDataSource() private readonly db: DataSource,
    private readonly moduleRef: ModuleRef,
  ) {}

  /**
   * Award XP for an action. Idempotent when a dedupeKey is supplied (the same
   * match/alert never double-awards), and respects per-reason daily caps.
   * Best-effort: callers fire-and-forget so XP never blocks the core action.
   */
  async award(
    userId: string,
    reason: XpReason,
    opts: { dedupeKey?: string } = {},
  ): Promise<void> {
    const amount = XP_AMOUNTS[reason];
    const cap = XP_DAILY_CAP[reason];

    if (cap !== undefined) {
      const rows = await this.db.query<Array<{ n: number }>>(
        `SELECT COUNT(*)::int AS n
           FROM xp_events
          WHERE user_id = $1 AND reason = $2
            AND created_at >= date_trunc('day', NOW())`,
        [userId, reason],
      );
      if ((rows[0]?.n ?? 0) >= cap) return;
    }

    await this.awardRaw(userId, amount, reason, opts.dedupeKey);
  }

  /**
   * Award an explicit XP amount under an arbitrary reason. Used for variable
   * rewards (e.g. challenge completions) where the amount isn't a fixed
   * per-reason constant. Idempotent when a dedupeKey is supplied.
   */
  async awardRaw(
    userId: string,
    amount: number,
    reason: string,
    dedupeKey?: string,
  ): Promise<void> {
    if (amount <= 0) return;

    const inserted = await this.db.query<Array<{ id: string }>>(
      `INSERT INTO xp_events (user_id, reason, amount, dedupe_key)
            VALUES ($1, $2, $3, $4)
       ON CONFLICT (user_id, dedupe_key) WHERE dedupe_key IS NOT NULL
       DO NOTHING
       RETURNING id`,
      [userId, reason, amount, dedupeKey ?? null],
    );
    if (inserted.length === 0) return; // deduped — already awarded

    const before = await this.db.query<Array<{ level: number; total_xp: number }>>(
      `SELECT level, total_xp FROM user_gamification WHERE user_id = $1`,
      [userId],
    );
    const previousLevel = before[0]?.level ?? 1;

    const after = await this.db.query<Array<{ level: number; total_xp: number }>>(
      `INSERT INTO user_gamification (user_id, total_xp, spendable_xp, level)
            VALUES ($1, $2, $2, $3)
       ON CONFLICT (user_id) DO UPDATE
          SET total_xp     = user_gamification.total_xp + $2,
              spendable_xp = user_gamification.spendable_xp + $2,
              level        = FLOOR(SQRT((user_gamification.total_xp + $2) / 50.0)) + 1,
              updated_at   = NOW()
       RETURNING level, total_xp`,
      [userId, amount, levelForXp(amount)],
    );
    const row = after[0];
    if (row && row.level > previousLevel) {
      const level = row.level;
      const totalXp = row.total_xp;
      const base = xpForLevel(level);
      const next = xpForLevel(level + 1);
      const evt: LevelUpEvent = {
        level,
        previousLevel,
        totalXp,
        xpIntoLevel: totalXp - base,
        xpForNextLevel: next - base,
      };
      this.emitLevelUpSafe(userId, evt);
    }
  }

  private emitLevelUpSafe(userId: string, evt: LevelUpEvent): void {
    try {
      const gw = this.moduleRef.get(RealtimeGateway, { strict: false });
      void gw
        .emitLevelUp(userId, evt)
        .catch((err: unknown) => this.logger.error(`level:up emit failed: ${err}`));
    } catch (err) {
      this.logger.warn(`level:up emit skipped (gateway unavailable): ${err}`);
    }
  }

  /**
   * Advance the daily streak. Called on app foreground / session restore.
   * Same-day pings are no-ops; consecutive days increment; a gap resets to 1.
   */
  async ping(userId: string): Promise<GamificationSummary> {
    await this.db.query(
      `INSERT INTO user_gamification (user_id, last_active_date, current_streak, longest_streak)
            VALUES ($1, CURRENT_DATE, 1, 1)
       ON CONFLICT (user_id) DO UPDATE
          SET current_streak = CASE
                WHEN user_gamification.last_active_date = CURRENT_DATE THEN user_gamification.current_streak
                WHEN user_gamification.last_active_date = CURRENT_DATE - 1 THEN user_gamification.current_streak + 1
                ELSE 1
              END,
              longest_streak = GREATEST(
                user_gamification.longest_streak,
                CASE
                  WHEN user_gamification.last_active_date = CURRENT_DATE THEN user_gamification.current_streak
                  WHEN user_gamification.last_active_date = CURRENT_DATE - 1 THEN user_gamification.current_streak + 1
                  ELSE 1
                END
              ),
              last_active_date = CURRENT_DATE,
              updated_at = NOW()`,
      [userId],
    );
    return this.getSummary(userId);
  }

  async getSummary(userId: string): Promise<GamificationSummary> {
    const [row] = await this.db.query<Array<{
      total_xp: number; current_streak: number; longest_streak: number;
    }>>(
      `SELECT total_xp, current_streak, longest_streak
         FROM user_gamification WHERE user_id = $1`,
      [userId],
    );
    return summaryForXp(
      row?.total_xp ?? 0,
      row?.current_streak ?? 0,
      row?.longest_streak ?? 0,
    );
  }

  /**
   * Ranked leaderboard for the given scope plus the caller's own rank (even when
   * off the top page). MVP is direct SQL; at scale the weekly board moves to a
   * Redis sorted set per ISO-week or a cron-refreshed materialized view.
   */
  async leaderboard(
    userId: string,
    scope: LeaderboardScope,
    limit = 50,
  ): Promise<LeaderboardPage> {
    const entries =
      scope === 'weekly'
        ? await this.weeklyTop(userId, limit)
        : await this.allTimeTop(userId, limit);

    const me =
      entries.find((e) => e.isMe) ??
      (scope === 'weekly' ? await this.weeklyMe(userId) : await this.allTimeMe(userId));

    if (scope === 'weekly') {
      const resetsAt = await this.weekResetsAt();
      return { scope, entries, me, ...(resetsAt ? { resetsAt } : {}) };
    }
    return { scope, entries, me };
  }

  private async weekResetsAt(): Promise<string | undefined> {
    const [row] = await this.db.query<Array<{ resets_at: Date }>>(
      `SELECT date_trunc('week', NOW()) + interval '7 days' AS resets_at`,
    );
    return row?.resets_at ? new Date(row.resets_at).toISOString() : undefined;
  }

  private allTimeTop(userId: string, limit: number): Promise<LeaderboardEntry[]> {
    return this.db.query<LeaderboardEntry[]>(
      `SELECT RANK() OVER (ORDER BY g.total_xp DESC)::int AS rank,
              g.user_id AS "userId", g.total_xp AS xp, g.level,
              u.display_name AS "displayName", u.avatar_url AS "avatarUrl",
              (g.user_id = $1) AS "isMe"
         FROM user_gamification g
         JOIN users u ON u.id = g.user_id AND u.deleted_at IS NULL
        WHERE g.total_xp > 0
        ORDER BY g.total_xp DESC
        LIMIT $2`,
      [userId, limit],
    );
  }

  private async allTimeMe(userId: string): Promise<LeaderboardEntry | null> {
    const [row] = await this.db.query<LeaderboardEntry[]>(
      `WITH ranked AS (
          SELECT user_id, total_xp, level,
                 RANK() OVER (ORDER BY total_xp DESC)::int AS rank
            FROM user_gamification WHERE total_xp > 0)
        SELECT r.rank, r.user_id AS "userId", r.total_xp AS xp, r.level,
               u.display_name AS "displayName", u.avatar_url AS "avatarUrl",
               true AS "isMe"
          FROM ranked r
          JOIN users u ON u.id = r.user_id AND u.deleted_at IS NULL
         WHERE r.user_id = $1`,
      [userId],
    );
    return row ?? null;
  }

  private weeklyTop(userId: string, limit: number): Promise<LeaderboardEntry[]> {
    return this.db.query<LeaderboardEntry[]>(
      `WITH weekly AS (
          SELECT user_id, SUM(amount)::int AS xp
            FROM xp_events
           WHERE created_at >= date_trunc('week', NOW())
           GROUP BY user_id)
        SELECT RANK() OVER (ORDER BY w.xp DESC)::int AS rank,
               w.user_id AS "userId", w.xp, COALESCE(g.level, 1) AS level,
               u.display_name AS "displayName", u.avatar_url AS "avatarUrl",
               (w.user_id = $1) AS "isMe"
          FROM weekly w
          JOIN users u ON u.id = w.user_id AND u.deleted_at IS NULL
          LEFT JOIN user_gamification g ON g.user_id = w.user_id
         ORDER BY w.xp DESC
         LIMIT $2`,
      [userId, limit],
    );
  }

  private async weeklyMe(userId: string): Promise<LeaderboardEntry | null> {
    const [row] = await this.db.query<LeaderboardEntry[]>(
      `WITH weekly AS (
          SELECT user_id, SUM(amount)::int AS xp
            FROM xp_events
           WHERE created_at >= date_trunc('week', NOW())
           GROUP BY user_id),
        ranked AS (
          SELECT user_id, xp, RANK() OVER (ORDER BY xp DESC)::int AS rank
            FROM weekly)
        SELECT r.rank, r.user_id AS "userId", r.xp, COALESCE(g.level, 1) AS level,
               u.display_name AS "displayName", u.avatar_url AS "avatarUrl",
               true AS "isMe"
          FROM ranked r
          JOIN users u ON u.id = r.user_id AND u.deleted_at IS NULL
          LEFT JOIN user_gamification g ON g.user_id = r.user_id
         WHERE r.user_id = $1`,
      [userId],
    );
    return row ?? null;
  }
}
