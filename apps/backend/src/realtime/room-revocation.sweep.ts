import { Injectable, Logger, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { InjectDataSource } from '@nestjs/typeorm';
import { DataSource } from 'typeorm';

import { ChatRealtimeAccessService } from '../modules/chat/chat-realtime-access.service';
import { RealtimeEmitterService } from './realtime-emitter.service';
import { roomRevocationOutboxEnabled } from './room-revocation.config';

interface ClaimedRevocation {
  id: string;
  conversationId: string;
  userId: string;
  attempts: number;
}

/**
 * Retriable, idempotent post-commit group-room revocation.
 * Emission-time recipient authorization remains the privacy boundary.
 * Redis adapter room snapshots are NOT a durable cross-node ACK.
 */
@Injectable()
export class RoomRevocationSweepService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(RoomRevocationSweepService.name);
  private timer: ReturnType<typeof setInterval> | null = null;
  private running = false;

  constructor(
    @InjectDataSource() private readonly db: DataSource,
    private readonly emitter: RealtimeEmitterService,
    private readonly access: ChatRealtimeAccessService,
  ) {}

  onModuleInit(): void {
    if (process.env.NODE_ENV === 'test' || !roomRevocationOutboxEnabled()) return;
    this.timer = setInterval(() => { void this.runOnce(); }, 10_000);
    this.timer.unref?.();
    void this.runOnce();
  }

  onModuleDestroy(): void {
    if (this.timer) clearInterval(this.timer);
    this.timer = null;
  }

  async runOnce(): Promise<void> {
    if (this.running) return;
    this.running = true;
    try {
      const items = await this.db.query<ClaimedRevocation[]>(`
        WITH pending AS (
          SELECT id FROM realtime_room_revocations
           WHERE completed_at IS NULL AND available_at <= NOW()
             AND (leased_until IS NULL OR leased_until < NOW())
           ORDER BY id LIMIT 16 FOR UPDATE SKIP LOCKED
        ), claimed AS (
          UPDATE realtime_room_revocations AS r
             SET attempts = r.attempts + 1,
                 leased_until = NOW() + INTERVAL '60 seconds'
            FROM pending WHERE r.id = pending.id
          RETURNING r.id::text AS id, r.conversation_id AS "conversationId",
                    r.user_id AS "userId", r.attempts AS attempts
        )
        SELECT id, "conversationId", "userId", attempts FROM claimed
      `);
      for (const item of items) await this.process(item);
    } catch (error) {
      this.logger.error('Room revocation sweep failed', error);
    } finally {
      this.running = false;
    }
  }

  private async process(item: ClaimedRevocation): Promise<void> {
    try {
      // Do not evict a user re-authorized after the original revocation.
      const authorized = (await this.access.getRecipientIds(item.conversationId))
        .includes(item.userId);
      if (!authorized) {
        const verified = await this.emitter.evictAndVerify(
          item.userId, `convo:${item.conversationId}`,
        );
        if (!verified) throw new Error('Remote room eviction not verified');
      }
      await this.db.query(
        `UPDATE realtime_room_revocations
             SET completed_at = NOW(), leased_until = NULL
           WHERE id = $1 AND attempts = $2 AND completed_at IS NULL`,
        [item.id, item.attempts],
      );
    } catch {
      const seconds = Math.min(300, 2 ** Math.min(item.attempts, 8));
      try {
        await this.db.query(
          `UPDATE realtime_room_revocations
             SET available_at = NOW() + ($3::int * INTERVAL '1 second'),
                 leased_until = NULL
           WHERE id = $1 AND attempts = $2 AND completed_at IS NULL`,
          [item.id, item.attempts, seconds],
        );
      } catch {
        // Lease expires in 60s; another node can resume the task.
        this.logger.error('Failed to release room revocation lease');
      }
      this.logger.warn('Room revocation pending verification; will retry');
    }
  }
}
