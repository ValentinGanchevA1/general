import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { InjectDataSource } from '@nestjs/typeorm';
import { DataSource } from 'typeorm';

import type {
  ReceivedInteraction,
  WaveRequest,
  WaveResponse,
  WaveReceivedEvent,
} from '@g88/shared';

import { RealtimeGateway } from '../../realtime/realtime.gateway';
import { NotificationsService } from '../notifications/notifications.service';
import { GamificationService } from '../gamification/gamification.service';
import { ChallengesService } from '../challenges/challenges.service';
import { AchievementsService } from '../achievements/achievements.service';
import { BlocksService } from '../blocks/blocks.service';

@Injectable()
export class InteractionsService {
  private readonly logger = new Logger(InteractionsService.name);
  private static readonly REWAVE_COOLDOWN_HOURS = 24;

  constructor(
    @InjectDataSource() private readonly db: DataSource,
    private readonly realtime: RealtimeGateway,
    private readonly notifications: NotificationsService,
    private readonly gamification: GamificationService,
    private readonly challenges: ChallengesService,
    private readonly achievements: AchievementsService,
    private readonly blocks: BlocksService,
  ) {}

  /**
   * Wave flow:
   *   1. Validate target exists and isn't self.
   *   2. Reject if either user has blocked the other (symmetric).
   *   3. Check cooldown window.
   *   4. If target has an OUTSTANDING wave to me → reciprocal. Open a conversation.
   *   5. Otherwise → insert wave row.
   *   6. Emit socket event to recipient (push fallback if offline).
   *
   * Runs in a single transaction so partial state never escapes.
   */
  async wave(fromUserId: string, req: WaveRequest): Promise<WaveResponse> {
    if (fromUserId === req.toUserId) {
      throw new BadRequestException({ code: 'wave.self', message: 'Cannot wave to yourself' });
    }

    // Symmetric block — either direction suppresses waves (mirrors gifts/messaging).
    if (await this.blocks.isBlocked(fromUserId, req.toUserId)) {
      throw new ForbiddenException({
        code: 'wave.blocked',
        message: 'You cannot wave at this user.',
      });
    }

    // Fetch sender for hydrated notification — single lookup, outside the tx.
    const senderRows = await this.db.query<Array<{ display_name: string; avatar_url: string | null; verification_level: string }>>(
      `SELECT display_name, avatar_url, verification_level FROM users WHERE id = $1 AND deleted_at IS NULL LIMIT 1`,
      [fromUserId],
    );
    if (!senderRows[0]) throw new NotFoundException({ code: 'wave.sender_missing', message: 'Sender not found' });
    const sender = senderRows[0];

    return this.db.transaction(async (tx) => {
      const target = await tx.query(
        `SELECT id FROM users WHERE id = $1 AND deleted_at IS NULL LIMIT 1`,
        [req.toUserId],
      );
      if (target.length === 0) {
        throw new BadRequestException({ code: 'wave.failed', message: 'Wave could not be sent' });
      }

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

      // Build the fully-hydrated event — gateway no longer does the lookup.
      const evt: WaveReceivedEvent = {
        waveId: wave.id,
        fromUser: {
          id: fromUserId,
          displayName: sender.display_name,
          avatarUrl: sender.avatar_url,
          verification: sender.verification_level as WaveReceivedEvent['fromUser']['verification'],
        },
        context: req.context ?? 'map',
        createdAt: wave.createdAt,
      };

      this.realtime
        .emitWaveReceived(req.toUserId, evt)
        .catch((err) => this.logger.error(`emitWaveReceived failed: ${err}`));

      // Push fallback: always fire — FCM is a no-op if the user is online
      // (socket delivery takes precedence on client; push arrives as silent update).
      this.notifications
        .notifyWave(req.toUserId, { id: fromUserId, displayName: sender.display_name }, req.context ?? 'map')
        .catch((err) => this.logger.error(`notifyWave failed: ${err}`));

      // Challenge progress: every wave counts toward "send waves" quests.
      // Awaited (but non-fatal) so the progress is committed before we return —
      // the client refetches /challenges/today right after the wave resolves, and
      // a fire-and-forget write here would race that refetch and read stale data.
      await this.challenges
        .increment(fromUserId, 'wave_sent')
        .catch((err) => this.logger.error(`challenge wave_sent failed: ${err}`));

      if (conversationId) {
        this.realtime
          .emitConversationOpened(conversationId, [fromUserId, req.toUserId], wave.id)
          .catch((err) => this.logger.error(`emitConversationOpened failed: ${err}`));

        // A reciprocated wave = a match. Reward both participants once per match.
        for (const uid of [fromUserId, req.toUserId]) {
          void this.gamification
            .award(uid, 'wave.reciprocated', { dedupeKey: `match:${conversationId}` })
            .catch((err) => this.logger.error(`award wave.reciprocated failed: ${err}`));
          void this.challenges
            .increment(uid, 'match_made')
            .catch((err) => this.logger.error(`challenge match_made failed: ${err}`));
          // Re-check achievements: the reciprocated-wave count + any level-up
          // from the XP just awarded may have crossed a threshold.
          void this.achievements
            .evaluate(uid)
            .catch((err) => this.logger.error(`achievement evaluate failed: ${err}`));
        }
      }

      return wave;
    });
  }

  private async openConversation(
    tx: { query: (sql: string, params?: unknown[]) => Promise<Array<{ id: string }>> },
    participantIds: string[],
  ): Promise<string> {
    const sorted = [...participantIds].sort();
    const existing = await tx.query(
      `SELECT id FROM conversations WHERE participant_ids = $1::uuid[] LIMIT 1`,
      [sorted],
    );
    if (existing.length > 0) {
      // A reciprocal wave is a match — promote any prior interest-request out of
      // the pending state so messaging is unrestricted both ways.
      await tx.query(
        `UPDATE conversations SET status = 'accepted' WHERE id = $1 AND status <> 'accepted'`,
        [existing[0]!.id],
      );
      return existing[0]!.id;
    }

    const created = await tx.query(
      `INSERT INTO conversations (participant_ids, status) VALUES ($1::uuid[], 'accepted') RETURNING id`,
      [sorted],
    );
    return created[0]!.id;
  }

  /**
   * Unified inbound list: waves + story reactions received by `userId`.
   * Used by the "People who interacted with you" surface.
   * isMutual is true when a reciprocal wave already exists OR an accepted conversation.
   */
  async listReceived(userId: string, limit = 50): Promise<ReceivedInteraction[]> {
    const rows = await this.db.query<
      Array<{
        id: string;
        kind: 'wave' | 'story_reaction';
        from_id: string;
        display_name: string;
        avatar_url: string | null;
        verification_level: string;
        story_id: string | null;
        reaction_kind: string | null;
        created_at: Date;
        is_mutual: boolean;
      }>
    >(
      `
      WITH blocked AS (
        SELECT blocked_id AS uid FROM user_blocks WHERE blocker_id = $1
        UNION
        SELECT blocker_id AS uid FROM user_blocks WHERE blocked_id = $1
      ),
      waves_in AS (
        SELECT
          w.id::text AS id,
          'wave'::text AS kind,
          w.from_user_id AS from_id,
          u.display_name,
          u.avatar_url,
          u.verification_level,
          NULL::text AS story_id,
          NULL::text AS reaction_kind,
          w.created_at,
          EXISTS (
            SELECT 1 FROM waves w2
             WHERE w2.from_user_id = $1 AND w2.to_user_id = w.from_user_id
          ) OR EXISTS (
            SELECT 1 FROM conversations c
             WHERE c.status = 'accepted'
               AND c.participant_ids @> ARRAY[$1::uuid, w.from_user_id]::uuid[]
          ) AS is_mutual
        FROM waves w
        JOIN users u ON u.id = w.from_user_id AND u.deleted_at IS NULL
        WHERE w.to_user_id = $1
          AND w.from_user_id NOT IN (SELECT uid FROM blocked)
      ),
      reactions_in AS (
        SELECT
          (sr.story_id::text || ':' || sr.user_id::text) AS id,
          'story_reaction'::text AS kind,
          sr.user_id AS from_id,
          u.display_name,
          u.avatar_url,
          u.verification_level,
          sr.story_id::text AS story_id,
          sr.kind AS reaction_kind,
          sr.created_at,
          EXISTS (
            SELECT 1 FROM waves w2
             WHERE w2.from_user_id = $1 AND w2.to_user_id = sr.user_id
          ) OR EXISTS (
            SELECT 1 FROM conversations c
             WHERE c.status = 'accepted'
               AND c.participant_ids @> ARRAY[$1::uuid, sr.user_id]::uuid[]
          ) AS is_mutual
        FROM story_reactions sr
        JOIN stories s ON s.id = sr.story_id AND s.deleted_at IS NULL AND s.expires_at > NOW()
        JOIN users u ON u.id = sr.user_id AND u.deleted_at IS NULL
        WHERE s.author_id = $1
          AND sr.user_id NOT IN (SELECT uid FROM blocked)
      )
      SELECT * FROM (
        SELECT * FROM waves_in
        UNION ALL
        SELECT * FROM reactions_in
      ) combined
      ORDER BY created_at DESC
      LIMIT $2
      `,
      [userId, limit],
    );

    return rows.map((r) => ({
      id: r.id,
      type: r.kind,
      fromUser: {
        id: r.from_id,
        displayName: r.display_name,
        avatarUrl: r.avatar_url,
        verification: r.verification_level as ReceivedInteraction['fromUser']['verification'],
      },
      ...(r.story_id ? { storyId: r.story_id } : {}),
      ...(r.reaction_kind
        ? { reactionKind: r.reaction_kind as 'heart' | 'wave' }
        : {}),
      createdAt: r.created_at.toISOString(),
      isMutual: r.is_mutual,
    }));
  }
}
