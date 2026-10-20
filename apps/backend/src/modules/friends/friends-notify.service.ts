import { Inject, Injectable, Logger, forwardRef } from '@nestjs/common';
import { InjectDataSource } from '@nestjs/typeorm';
import { DataSource } from 'typeorm';

import { NotificationsService } from '../notifications/notifications.service';
import { RealtimeGateway } from '../../realtime/realtime.gateway';

/**
 * Side-effects for friend-request lifecycle: durable Activity + FCM + Socket.IO.
 * Kept separate so FriendsService stays focused on the graph.
 */
@Injectable()
export class FriendsNotifyService {
  private readonly logger = new Logger(FriendsNotifyService.name);

  constructor(
    @InjectDataSource() private readonly db: DataSource,
    private readonly notifications: NotificationsService,
    @Inject(forwardRef(() => RealtimeGateway))
    private readonly realtime: RealtimeGateway,
  ) {}

  async onRequestCreated(
    fromUserId: string,
    toUserId: string,
    requestId: string,
  ): Promise<void> {
    try {
      const from = await this.loadUser(fromUserId);
      if (!from) return;
      const count = await this.countPending(toUserId);
      await this.realtime.emitFriendRequest(toUserId, {
        requestId,
        fromUser: {
          id: from.id,
          displayName: from.displayName,
          avatarUrl: from.avatarUrl,
        },
        createdAt: new Date().toISOString(),
        pendingCount: count,
      });
      await this.notifications.notifyFriendRequest(toUserId, {
        id: from.id,
        displayName: from.displayName,
      });
    } catch (err) {
      this.logger.error(`onRequestCreated failed: ${err}`);
    }
  }

  async onRequestAccepted(requesterId: string, addresseeId: string): Promise<void> {
    try {
      const peer = await this.loadUser(addresseeId);
      if (!peer) return;

      await this.db.query(
        `INSERT INTO personal_activity_notifications
           (recipient_id, actor_id, kind, source_type, source_id, destination)
         VALUES ($1, $2, 'friend_accepted', 'friendship', $3,
                 jsonb_build_object('type', 'profile', 'userId', $2::text))
         ON CONFLICT (recipient_id, source_type, source_id) DO NOTHING`,
        [requesterId, peer.id, this.friendshipSourceId(requesterId, peer.id)],
      );

      await this.realtime.emitFriendAccepted(requesterId, {
        peerUserId: peer.id,
        peerDisplayName: peer.displayName,
        peerAvatarUrl: peer.avatarUrl,
        acceptedAt: new Date().toISOString(),
      });
      await this.notifications.notifyFriendAccepted(requesterId, {
        id: peer.id,
        displayName: peer.displayName,
      });
    } catch (err) {
      this.logger.error(`onRequestAccepted failed: ${err}`);
    }
  }

  async countPending(userId: string): Promise<number> {
    const [row] = await this.db.query<Array<{ n: string }>>(
      `SELECT COUNT(*)::text AS n
         FROM friend_requests
        WHERE addressee_id = $1 AND status = 'pending'`,
      [userId],
    );
    return Number(row?.n ?? 0);
  }

  private friendshipSourceId(userA: string, userB: string): string {
    return [userA, userB].sort().join(':');
  }

  private async loadUser(
    userId: string,
  ): Promise<{ id: string; displayName: string; avatarUrl: string | null } | null> {
    const [row] = await this.db.query<
      Array<{ id: string; display_name: string; avatar_url: string | null }>
    >(
      `SELECT id, display_name, avatar_url FROM users WHERE id = $1 AND deleted_at IS NULL LIMIT 1`,
      [userId],
    );
    if (!row) return null;
    return { id: row.id, displayName: row.display_name, avatarUrl: row.avatar_url };
  }
}
