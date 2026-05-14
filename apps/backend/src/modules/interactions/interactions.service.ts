import {
  BadRequestException,
  ConflictException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { InjectDataSource } from '@nestjs/typeorm';
import { DataSource } from 'typeorm';

import type { WaveRequest, WaveResponse } from '@g88/shared';

import { RealtimeGateway } from '../../realtime/realtime.gateway';

@Injectable()
export class InteractionsService {
  private readonly logger = new Logger(InteractionsService.name);
  /**
   * Anti-spam window: a user can only wave at the same target once every N hours.
   * Prevents the "wave every 5 minutes hoping for a reply" loop.
   */
  private static readonly REWAVE_COOLDOWN_HOURS = 24;

  constructor(
    @InjectDataSource() private readonly db: DataSource,
    private readonly realtime: RealtimeGateway,
  ) {}

  /**
   * Wave flow:
   *   1. Validate target exists and isn't self.
   *   2. Check cooldown window.
   *   3. If target has an OUTSTANDING wave to me → reciprocal. Open a conversation.
   *   4. Otherwise → insert wave row.
   *   5. Emit socket event to recipient. Fire push if they're offline.
   *
   * The whole thing runs in a single transaction so a partial state never escapes.
   */
  async wave(fromUserId: string, req: WaveRequest): Promise<WaveResponse> {
    if (fromUserId === req.toUserId) {
      throw new BadRequestException({ code: 'wave.self', message: 'Cannot wave to yourself' });
    }

    return this.db.transaction(async (tx) => {
      const target = await tx.query(
        `SELECT id FROM users WHERE id = $1 AND deleted_at IS NULL LIMIT 1`,
        [req.toUserId],
      );
      if (target.length === 0) {
        throw new NotFoundException({ code: 'wave.target_missing', message: 'User not found' });
      }

      // Cooldown check — prevent spam-waving.
      const recent = await tx.query(
        `SELECT 1 FROM waves
          WHERE from_user_id = $1 AND to_user_id = $2
            AND created_at > NOW() - ($3 || ' hours')::interval
          LIMIT 1`,
        [fromUserId, req.toUserId, InteractionsService.REWAVE_COOLDOWN_HOURS],
      );
      if (recent.length > 0) {
        throw new ConflictException({
          code: 'wave.cooldown',
          message: `You waved at this user recently; try again later`,
        });
      }

      // Reciprocal? Look for an outstanding (no conversation_id yet) wave the other way.
      const reciprocal = await tx.query(
        `SELECT id FROM waves
          WHERE from_user_id = $1 AND to_user_id = $2
            AND conversation_id IS NULL
            AND created_at > NOW() - interval '14 days'
          LIMIT 1`,
        [req.toUserId, fromUserId],
      );

      let conversationId: string | null = null;
      if (reciprocal.length > 0) {
        conversationId = await this.openConversation(tx, [fromUserId, req.toUserId]);
        await tx.query(
          `UPDATE waves SET conversation_id = $1, responded_at = NOW() WHERE id = $2`,
          [conversationId, reciprocal[0].id],
        );
      }

      const inserted = await tx.query(
        `INSERT INTO waves (from_user_id, to_user_id, context, conversation_id)
              VALUES ($1, $2, $3, $4)
           RETURNING id, created_at`,
        [fromUserId, req.toUserId, req.context ?? 'map', conversationId],
      );

      const wave: WaveResponse = {
        id: inserted[0].id,
        fromUserId,
        toUserId: req.toUserId,
        createdAt: inserted[0].created_at.toISOString(),
        conversationId,
      };

      // Fire-and-forget realtime delivery. The gateway falls back to push if offline.
      this.realtime
        .emitWaveReceived(req.toUserId, wave, req.context ?? 'map')
        .catch((err) => this.logger.error(`emitWaveReceived failed: ${err}`));

      if (conversationId) {
        this.realtime
          .emitConversationOpened(conversationId, [fromUserId, req.toUserId], wave.id)
          .catch((err) => this.logger.error(`emitConversationOpened failed: ${err}`));
      }

      return wave;
    });
  }

  private async openConversation(
    tx: { query: (sql: string, params?: unknown[]) => Promise<any[]> },
    participantIds: string[],
  ): Promise<string> {
    const sorted = [...participantIds].sort();
    // Idempotent insert: if a conversation between these two already exists, return it.
    const existing = await tx.query(
      `SELECT id FROM conversations WHERE participant_ids = $1::uuid[] LIMIT 1`,
      [sorted],
    );
    if (existing.length > 0) return existing[0].id;

    const created = await tx.query(
      `INSERT INTO conversations (participant_ids) VALUES ($1::uuid[]) RETURNING id`,
      [sorted],
    );
    return created[0].id;
  }
}
