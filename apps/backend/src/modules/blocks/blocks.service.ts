import { BadRequestException, Inject, Injectable, forwardRef } from '@nestjs/common';
import { InjectDataSource } from '@nestjs/typeorm';
import { DataSource } from 'typeorm';

import { FriendsService } from '../friends/friends.service';

export interface BlockedUserRow {
  id: string;
  displayName: string;
  avatarUrl: string | null;
  blockedAt: string;
}

/**
 * Owns user-to-user blocking. Storage is directional (blocker_id/blocked_id),
 * but the effect is symmetric and checked independently from interaction/read
 * surfaces. Blocking also tears down relationship state and active live-location
 * sessions so a block becomes an immediate privacy boundary.
 */
@Injectable()
export class BlocksService {
  constructor(
    @InjectDataSource() private readonly db: DataSource,
    @Inject(forwardRef(() => FriendsService))
    private readonly friends: FriendsService,
  ) {}

  async block(blockerId: string, blockedId: string): Promise<void> {
    if (blockerId === blockedId) {
      throw new BadRequestException({ code: 'blocks.self', message: 'Cannot block yourself' });
    }
    await this.db.query(
      `INSERT INTO user_blocks (blocker_id, blocked_id)
            VALUES ($1, $2)
       ON CONFLICT (blocker_id, blocked_id) DO NOTHING`,
      [blockerId, blockedId],
    );

    // A live-location share is sensitive data. End any active sessions in a
    // conversation containing both users as soon as the block becomes durable.
    await this.db.query(
      `UPDATE chat_location_sessions cls
          SET status = 'ended',
              ended_at = NOW(),
              end_reason = 'blocked'
        WHERE cls.status = 'active'
          AND EXISTS (
                SELECT 1
                  FROM conversations c
                 WHERE c.id = cls.conversation_id
                   AND $1 = ANY(c.participant_ids)
                   AND $2 = ANY(c.participant_ids)
              )`,
      [blockerId, blockedId],
    );

    // Hard-delete social graph edges (follows, friendships, pending requests).
    await this.friends.onBlock(blockerId, blockedId);
  }

  async unblock(blockerId: string, blockedId: string): Promise<void> {
    await this.db.query(`DELETE FROM user_blocks WHERE blocker_id = $1 AND blocked_id = $2`, [
      blockerId,
      blockedId,
    ]);
  }

  /** Directional: true only if `blockerId` has blocked `blockedId`. Drives the
   *  viewer-relative Block ⇄ Unblock toggle (`PublicUserProfile.blockedByViewer`). */
  async hasBlocked(blockerId: string, blockedId: string): Promise<boolean> {
    const [row] = await this.db.query<Array<{ exists: boolean }>>(
      `SELECT EXISTS (
         SELECT 1 FROM user_blocks WHERE blocker_id = $1 AND blocked_id = $2
       ) AS exists`,
      [blockerId, blockedId],
    );
    return row?.exists ?? false;
  }

  /** Symmetric: true if EITHER user has blocked the other. */
  async isBlocked(userA: string, userB: string): Promise<boolean> {
    const [row] = await this.db.query<Array<{ exists: boolean }>>(
      `SELECT EXISTS (
         SELECT 1 FROM user_blocks
          WHERE (blocker_id = $1 AND blocked_id = $2)
             OR (blocker_id = $2 AND blocked_id = $1)
       ) AS exists`,
      [userA, userB],
    );
    return row?.exists ?? false;
  }

  /** Users the caller has explicitly blocked — directional, for a settings list. */
  async listBlockedBy(blockerId: string): Promise<BlockedUserRow[]> {
    return this.db.query<BlockedUserRow[]>(
      `SELECT u.id, u.display_name AS "displayName", u.avatar_url AS "avatarUrl",
              ub.created_at AS "blockedAt"
         FROM user_blocks ub
         JOIN users u ON u.id = ub.blocked_id
        WHERE ub.blocker_id = $1
        ORDER BY ub.created_at DESC`,
      [blockerId],
    );
  }
}
