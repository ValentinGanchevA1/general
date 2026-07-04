import { Injectable, Logger } from '@nestjs/common';
import { InjectDataSource } from '@nestjs/typeorm';
import { DataSource } from 'typeorm';

import {
  ACHIEVEMENTS,
  type AchievementDef,
  type AchievementStatus,
} from '@g88/shared';

import { GamificationService } from '../gamification/gamification.service';
import { RealtimeGateway } from '../../realtime/realtime.gateway';

@Injectable()
export class AchievementsService {
  private readonly logger = new Logger(AchievementsService.name);

  constructor(
    @InjectDataSource() private readonly db: DataSource,
    private readonly gamification: GamificationService,
    private readonly realtime: RealtimeGateway,
  ) {}

  /**
   * Re-evaluate this user's still-locked achievements and unlock any newly
   * satisfied. Fire-and-forget from action sites (after a wave match, an alert,
   * a streak ping) — mirrors challenges.increment. Cheap: one read of unlocked
   * ids, one summary read, one grouped count over the reasons still in play.
   *
   * Bonus XP from a level-* unlock can push the user over the next level, but
   * evaluate is not re-entered here, so that next milestone is picked up on the
   * user's following rewarded action (acceptable; no recursion).
   */
  async evaluate(userId: string): Promise<void> {
    const have = new Set(
      (
        await this.db.query<Array<{ achievement_id: string }>>(
          `SELECT achievement_id FROM user_achievements WHERE user_id = $1`,
          [userId],
        )
      ).map((r) => r.achievement_id),
    );
    const pending = ACHIEVEMENTS.filter((a) => !have.has(a.id));
    if (pending.length === 0) return;

    const [g] = await this.db.query<Array<{ level: number; longest_streak: number }>>(
      `SELECT level, longest_streak FROM user_gamification WHERE user_id = $1`,
      [userId],
    );
    const level = g?.level ?? 1;
    const longestStreak = g?.longest_streak ?? 0;

    // One grouped count for every reason a pending count-achievement needs.
    const reasons = [
      ...new Set(pending.filter((a) => a.kind === 'count').map((a) => a.metric!)),
    ];
    const counts = new Map<string, number>();
    if (reasons.length > 0) {
      const rows = await this.db.query<Array<{ reason: string; n: number }>>(
        `SELECT reason, COUNT(*)::int AS n
           FROM xp_events
          WHERE user_id = $1 AND reason = ANY($2)
          GROUP BY reason`,
        [userId, reasons],
      );
      rows.forEach((r) => counts.set(r.reason, r.n));
    }

    for (const def of pending) {
      const value =
        def.kind === 'level'
          ? level
          : def.kind === 'streak'
            ? longestStreak
            : (counts.get(def.metric!) ?? 0);
      if (value >= def.threshold) await this.unlock(userId, def, value);
    }
  }

  /** Full catalog merged with this user's unlock + derived progress state. */
  async list(userId: string): Promise<AchievementStatus[]> {
    const unlocked = new Map(
      (
        await this.db.query<Array<{ achievement_id: string; unlocked_at: Date }>>(
          `SELECT achievement_id, unlocked_at FROM user_achievements WHERE user_id = $1`,
          [userId],
        )
      ).map((r) => [r.achievement_id, r.unlocked_at]),
    );

    const [g] = await this.db.query<Array<{ level: number; longest_streak: number }>>(
      `SELECT level, longest_streak FROM user_gamification WHERE user_id = $1`,
      [userId],
    );
    const countRows = await this.db.query<Array<{ reason: string; n: number }>>(
      `SELECT reason, COUNT(*)::int AS n FROM xp_events WHERE user_id = $1 GROUP BY reason`,
      [userId],
    );
    const counts = new Map(countRows.map((r) => [r.reason, r.n]));

    return ACHIEVEMENTS.map((def) => {
      const raw =
        def.kind === 'level'
          ? (g?.level ?? 1)
          : def.kind === 'streak'
            ? (g?.longest_streak ?? 0)
            : (counts.get(def.metric!) ?? 0);
      const at = unlocked.get(def.id) ?? null;
      return {
        id: def.id,
        title: def.title,
        description: def.description,
        icon: def.icon,
        threshold: def.threshold,
        progress: Math.min(raw, def.threshold),
        unlocked: at != null,
        unlockedAt: at ? at.toISOString() : null,
      };
    });
  }

  private async unlock(
    userId: string,
    def: AchievementDef,
    value: number,
  ): Promise<void> {
    const ins = await this.db.query<Array<{ unlocked_at: Date }>>(
      `INSERT INTO user_achievements (user_id, achievement_id, unlocked_value)
            VALUES ($1, $2, $3)
       ON CONFLICT (user_id, achievement_id) DO NOTHING
       RETURNING unlocked_at`,
      [userId, def.id, value],
    );
    if (ins.length === 0) return; // already unlocked — idempotent

    if (def.rewardXp > 0) {
      // dedupeKey ties the bonus to the achievement, so it can never double-pay.
      await this.gamification
        .awardRaw(userId, def.rewardXp, 'achievement.unlocked', `achievement:${def.id}`)
        .catch((err) => this.logger.error(`achievement reward failed: ${err}`));
    }

    // Live unlock event → mobile toast + haptic (AchievementToastHost). Fire-and-forget:
    // a delivery failure must never roll back the (already-committed) unlock. If the user is
    // offline, they see the unlock on their next `GET /achievements` read.
    void this.realtime
      .emitAchievementUnlocked(userId, {
        id: def.id,
        title: def.title,
        description: def.description,
        icon: def.icon,
        rewardXp: def.rewardXp,
        unlockedAt: ins[0]!.unlocked_at.toISOString(),
      })
      .catch((err) => this.logger.error(`achievement emit failed: ${err}`));
  }
}
