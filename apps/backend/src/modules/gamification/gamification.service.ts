import { Injectable, Logger } from '@nestjs/common';
import { InjectDataSource } from '@nestjs/typeorm';
import { DataSource } from 'typeorm';

import {
  type GamificationSummary,
  type XpReason,
  XP_AMOUNTS,
  XP_DAILY_CAP,
  levelForXp,
  summaryForXp,
} from '@g88/shared';

@Injectable()
export class GamificationService {
  private readonly logger = new Logger(GamificationService.name);

  constructor(@InjectDataSource() private readonly db: DataSource) {}

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

    // Bump the denormalized summary. Level recomputed in SQL from the new total
    // so the DB stays authoritative even under concurrent awards.
    await this.db.query(
      `INSERT INTO user_gamification (user_id, total_xp, level)
            VALUES ($1, $2, $3)
       ON CONFLICT (user_id) DO UPDATE
          SET total_xp   = user_gamification.total_xp + $2,
              level      = FLOOR(SQRT((user_gamification.total_xp + $2) / 50.0)) + 1,
              updated_at = NOW()`,
      [userId, amount, levelForXp(amount)],
    );
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
}
