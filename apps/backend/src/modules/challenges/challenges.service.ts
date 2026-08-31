import { Injectable, Logger } from '@nestjs/common';
import { ModuleRef } from '@nestjs/core';
import { InjectDataSource } from '@nestjs/typeorm';
import { DataSource } from 'typeorm';

import {
  type ChallengeMetric,
  type ChallengeToday,
  dailyChallenges,
} from '@g88/shared';

import { GamificationService } from '../gamification/gamification.service';
import { RealtimeGateway } from '../../realtime/realtime.gateway';

function todayISO(): string {
  return new Date().toISOString().slice(0, 10);
}

@Injectable()
export class ChallengesService {
  private readonly logger = new Logger(ChallengesService.name);

  constructor(
    @InjectDataSource() private readonly db: DataSource,
    private readonly gamification: GamificationService,
    private readonly moduleRef: ModuleRef,
  ) {}

  /**
   * Advance every active challenge that tracks this metric. Called fire-and-forget
   * from action sites (wave, alert, chat). When a challenge crosses its target for
   * the first time, completed_at is stamped and its bonus XP awarded exactly once.
   */
  async increment(userId: string, metric: ChallengeMetric, by = 1): Promise<void> {
    const day = todayISO();
    const active = dailyChallenges(day).filter((c) => c.metric === metric);
    if (active.length === 0) return;

    for (const c of active) {
      const rows = await this.db.query<Array<{ progress: number; was_completed: boolean }>>(
        `INSERT INTO challenge_progress (user_id, challenge_id, day, progress)
              VALUES ($1, $2, $3, $4)
         ON CONFLICT (user_id, challenge_id, day) DO UPDATE
            SET progress   = challenge_progress.progress + $4,
                updated_at = NOW()
         RETURNING progress, (completed_at IS NOT NULL) AS was_completed`,
        [userId, c.id, day, by],
      );
      const row = rows[0];
      if (!row || row.was_completed) continue;

      if (row.progress >= c.target) {
        const done = await this.db.query<Array<{ id: string }>>(
          `UPDATE challenge_progress
              SET completed_at = NOW()
            WHERE user_id = $1 AND challenge_id = $2 AND day = $3
              AND completed_at IS NULL
            RETURNING challenge_id AS id`,
          [userId, c.id, day],
        );
        if (done.length > 0) {
          await this.gamification
            .awardRaw(userId, c.rewardXp, 'challenge.completed', `challenge:${c.id}:${day}`)
            .catch((err) => this.logger.error(`challenge reward failed: ${err}`));

          this.emitChallengeCompletedSafe(userId, {
            challengeId: c.id,
            title: c.title,
            rewardXp: c.rewardXp,
            icon: '✅',
          });
        }
      }
    }
  }

  private emitChallengeCompletedSafe(
    userId: string,
    evt: { challengeId: string; title: string; rewardXp: number; icon?: string },
  ): void {
    try {
      const gw = this.moduleRef.get(RealtimeGateway, { strict: false });
      void gw
        .emitChallengeCompleted(userId, evt)
        .catch((err: unknown) =>
          this.logger.error(`challenge:completed emit failed: ${err}`),
        );
    } catch (err) {
      this.logger.warn(`challenge:completed emit skipped: ${err}`);
    }
  }

  async getToday(userId: string): Promise<ChallengeToday[]> {
    const day = todayISO();
    const defs = dailyChallenges(day);

    const rows = await this.db.query<Array<{
      challenge_id: string; progress: number; completed_at: Date | null;
    }>>(
      `SELECT challenge_id, progress, completed_at
         FROM challenge_progress
        WHERE user_id = $1 AND day = $2`,
      [userId, day],
    );
    const byId = new Map(rows.map((r) => [r.challenge_id, r]));

    return defs.map((c) => {
      const p = byId.get(c.id);
      return {
        id: c.id,
        title: c.title,
        target: c.target,
        rewardXp: c.rewardXp,
        progress: Math.min(p?.progress ?? 0, c.target),
        completed: p?.completed_at != null,
      };
    });
  }
}
