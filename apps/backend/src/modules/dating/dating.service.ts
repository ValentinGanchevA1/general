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

import type { LikeRequest, LikeResponse } from '@g88/shared';

import { RealtimeGateway } from '../../realtime/realtime.gateway';
import { BlocksService } from '../blocks/blocks.service';

@Injectable()
export class DatingService {
  private readonly logger = new Logger(DatingService.name);

  constructor(
    @InjectDataSource() private readonly db: DataSource,
    private readonly realtime: RealtimeGateway,
    private readonly blocks: BlocksService,
  ) {}

  /**
   * Dating like:
   * 1. Self / block / both open_to_dating checks
   * 2. Insert like (unique)
   * 3. If reciprocal outstanding like → match + conversation
   * 4. Emit dating:like_received / dating:match_created
   */
  async like(fromUserId: string, req: LikeRequest): Promise<LikeResponse> {
    if (fromUserId === req.toUserId) {
      throw new BadRequestException({
        code: 'dating.like.self',
        message: 'Cannot like yourself',
      });
    }

    if (await this.blocks.isBlocked(fromUserId, req.toUserId)) {
      throw new ForbiddenException({
        code: 'dating.like.blocked',
        message: 'You cannot like this user.',
      });
    }

    const users = await this.db.query<
      Array<{ id: string; open_to_dating: boolean; display_name: string; avatar_url: string | null }>
    >(
      `SELECT id, open_to_dating, display_name, avatar_url
         FROM users
        WHERE id = ANY($1::uuid[]) AND deleted_at IS NULL`,
      [[fromUserId, req.toUserId]],
    );
    const byId = new Map(users.map((u) => [u.id, u]));
    const from = byId.get(fromUserId);
    const to = byId.get(req.toUserId);
    if (!from || !to) {
      throw new NotFoundException({
        code: 'dating.like.user_missing',
        message: 'User not found',
      });
    }
    if (!from.open_to_dating || !to.open_to_dating) {
      throw new ForbiddenException({
        code: 'dating.like.not_open',
        message: 'Both users must be open to dating.',
      });
    }

    return this.db.transaction(async (tx) => {
      const existing = await tx.query(
        `SELECT id FROM dating_likes
          WHERE from_user_id = $1 AND to_user_id = $2 LIMIT 1`,
        [fromUserId, req.toUserId],
      );
      if (existing.length > 0) {
        throw new ConflictException({
          code: 'dating.like.duplicate',
          message: 'You already liked this user.',
        });
      }

      // Clear pass if re-liking after pass
      await tx.query(
        `DELETE FROM dating_passes WHERE from_user_id = $1 AND to_user_id = $2`,
        [fromUserId, req.toUserId],
      );

      const inserted = await tx.query(
        `INSERT INTO dating_likes (from_user_id, to_user_id)
              VALUES ($1, $2)
           RETURNING id, created_at`,
        [fromUserId, req.toUserId],
      );

      const reciprocal = await tx.query(
        `SELECT id FROM dating_likes
          WHERE from_user_id = $1 AND to_user_id = $2 LIMIT 1`,
        [req.toUserId, fromUserId],
      );

      let matched = false;
      let datingConversationId: string | null = null;

      if (reciprocal.length > 0) {
        matched = true;
        const [a, b] =
          fromUserId < req.toUserId
            ? [fromUserId, req.toUserId]
            : [req.toUserId, fromUserId];

        datingConversationId = await this.openConversation(tx, [fromUserId, req.toUserId]);

        await tx.query(
          `INSERT INTO dating_matches (user_a_id, user_b_id, conversation_id)
                VALUES ($1, $2, $3)
           ON CONFLICT (user_a_id, user_b_id) DO UPDATE
             SET conversation_id = COALESCE(dating_matches.conversation_id, EXCLUDED.conversation_id)
           RETURNING id`,
          [a, b, datingConversationId],
        );
      }

      const res: LikeResponse = {
        id: inserted[0].id,
        fromUserId,
        toUserId: req.toUserId,
        createdAt: inserted[0].created_at.toISOString(),
        matched,
        datingConversationId,
      };

      // Notify recipient of like (non-match) or both of match
      if (matched && datingConversationId) {
        const matchEvt = {
          peerUserId: fromUserId,
          peerDisplayName: from.display_name,
          peerAvatarUrl: from.avatar_url,
          datingConversationId,
          createdAt: res.createdAt,
        };
        const matchEvtPeer = {
          peerUserId: req.toUserId,
          peerDisplayName: to.display_name,
          peerAvatarUrl: to.avatar_url,
          datingConversationId,
          createdAt: res.createdAt,
        };
        void this.realtime
          .emitDatingMatchCreated(req.toUserId, matchEvt)
          .catch((err) => this.logger.error(`emitDatingMatchCreated: ${err}`));
        void this.realtime
          .emitDatingMatchCreated(fromUserId, matchEvtPeer)
          .catch((err) => this.logger.error(`emitDatingMatchCreated self: ${err}`));
      } else {
        void this.realtime
          .emitDatingLikeReceived(req.toUserId, {
            likeId: res.id,
            fromUser: {
              id: fromUserId,
              displayName: from.display_name,
              avatarUrl: from.avatar_url,
            },
            createdAt: res.createdAt,
          })
          .catch((err) => this.logger.error(`emitDatingLikeReceived: ${err}`));
      }

      return res;
    });
  }

  async pass(fromUserId: string, toUserId: string): Promise<{ ok: true }> {
    if (fromUserId === toUserId) {
      throw new BadRequestException({
        code: 'dating.pass.self',
        message: 'Cannot pass yourself',
      });
    }
    if (await this.blocks.isBlocked(fromUserId, toUserId)) {
      throw new ForbiddenException({
        code: 'dating.pass.blocked',
        message: 'You cannot interact with this user.',
      });
    }

    await this.db.query(
      `INSERT INTO dating_passes (from_user_id, to_user_id)
            VALUES ($1, $2)
       ON CONFLICT (from_user_id, to_user_id) DO NOTHING`,
      [fromUserId, toUserId],
    );
    // Optional: remove outbound like
    await this.db.query(
      `DELETE FROM dating_likes WHERE from_user_id = $1 AND to_user_id = $2`,
      [fromUserId, toUserId],
    );
    return { ok: true };
  }

  private async openConversation(
    tx: { query: (sql: string, params?: unknown[]) => Promise<Array<{ id: string }>> },
    participantIds: string[],
  ): Promise<string> {
    const sorted = [...participantIds].sort((a, b) => a.localeCompare(b));
    const existing = await tx.query(
      `SELECT id FROM conversations WHERE participant_ids = $1::uuid[] LIMIT 1`,
      [sorted],
    );
    if (existing.length > 0) {
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
}
