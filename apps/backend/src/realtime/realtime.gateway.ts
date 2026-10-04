import {
  WebSocketGateway,
  WebSocketServer,
  SubscribeMessage,
  OnGatewayConnection,
  OnGatewayDisconnect,
  OnGatewayInit,
  ConnectedSocket,
  MessageBody,
} from '@nestjs/websockets';
import { Server, Socket } from 'socket.io';
import { Injectable, Logger, Inject, forwardRef } from '@nestjs/common';
import type {
  PresenceUpdateEvent,
  ChatMessageEvent,
  LevelUpEvent,
  GiftReceivedEvent,
  ChallengeCompletedEvent,
  FriendRequestEvent,
  FriendAcceptedEvent,
  LocationShareEndedEvent,
  VerificationProgressEvent,
  SocketData,
} from '@g88/shared';

import { WsJwtGuard } from './ws-jwt.guard';
import { PresenceService } from '../modules/presence/presence.service';
import { ChatService } from '../modules/chat/chat.service';
import { AuthService } from '../modules/auth/auth.service';
import { corsOrigins } from '../common/cors-origins';

/**
 * Main Socket.IO gateway for G88 realtime: presence, chat, notifications, events.
 * Namespace: `/realtime`
 *
 * Auth: JWT via socket.handshake.auth.token
 * Rooms:
 *   - `user:<userId>` — user-scoped events (level up, gifts, challenges, friend requests)
 *   - `conversation:<conversationId>` — chat in a conversation
 *   - `event:<eventId>` — RSVP polling, attendee updates
 *   - `cell:<h3CellId>` — presence updates for nearby users at that cell
 */
@WebSocketGateway({
  namespace: '/realtime',
  cors: {
    origin: corsOrigins(),
    credentials: true,
  },
})
@Injectable()
export class RealtimeGateway implements OnGatewayInit, OnGatewayConnection, OnGatewayDisconnect {
  @WebSocketServer()
  server!: Server;

  private readonly logger = new Logger(RealtimeGateway.name);

  constructor(
    private readonly auth: AuthService,
    private readonly presence: PresenceService,
    private readonly chat: ChatService,
  ) {}

  afterInit(): void {
    this.logger.log(`Socket.IO /realtime namespace ready. CORS: ${corsOrigins().join(', ')}`);
  }

  async handleConnection(client: Socket): Promise<void> {
    const token = client.handshake.auth.token;
    if (!token) {
      this.logger.warn(`[connect] rejected: no auth token`);
      client.disconnect(true);
      return;
    }

    try {
      const user = await this.auth.validateToken(token);
      if (!user) {
        this.logger.warn(`[connect] rejected: invalid token`);
        client.disconnect(true);
        return;
      }

      const data: SocketData = {
        userId: user.id,
        rooms: new Set(),
      };
      (client as any).data = data;

      this.logger.debug(`[connect] user=${user.id}`);
    } catch (err) {
      this.logger.warn(`[connect] auth error: ${err}`);
      client.disconnect(true);
    }
  }

  handleDisconnect(client: Socket): void {
    const userId = (client.data as SocketData | undefined)?.userId;
    if (!userId) return;
    this.logger.debug(`[disconnect] user=${userId}`);
  }

  /**
   * Client: send presence update (location + online status).
   * Broadcasts to cell-scoped rooms for nearby discovery.
   */
  @SubscribeMessage('presence:update')
  async handlePresenceUpdate(
    @ConnectedSocket() client: Socket,
    @MessageBody() payload: PresenceUpdateEvent,
  ): Promise<{ ok: boolean; error?: string }> {
    const userId = (client.data as SocketData).userId;

    try {
      const cell = await this.presence.updatePresence(userId, payload.location);
      // Announce to the new cell so nearby users see the arrival.
      if (cell) {
        client.join(`cell:${cell}`);
        this.server.to(`cell:${cell}`).emit('presence:nearby', {
          userId,
          location: payload.location,
          timestamp: new Date().toISOString(),
        });
      }
      return { ok: true };
    } catch (err) {
      this.logger.error(`presence:update failed: ${err}`);
      return { ok: false, error: String(err) };
    }
  }

  /**
   * Client: join a conversation for live chat.
   */
  @SubscribeMessage('conversation:join')
  async handleConversationJoin(
    @ConnectedSocket() client: Socket,
    @MessageBody() payload: { conversationId: string },
  ): Promise<{ ok: boolean; error?: string }> {
    const userId = (client.data as SocketData).userId;

    try {
      await this.chat.validateConversationAccess(userId, payload.conversationId);
      client.join(`conversation:${payload.conversationId}`);
      (client.data as SocketData).rooms.add(`conversation:${payload.conversationId}`);
      return { ok: true };
    } catch (err) {
      this.logger.error(`conversation:join failed: ${err}`);
      return { ok: false, error: String(err) };
    }
  }

  /**
   * Client: send a chat message in a conversation.
   */
  @SubscribeMessage('chat:send')
  async handleChatSend(
    @ConnectedSocket() client: Socket,
    @MessageBody() payload: { conversationId: string; body: string; clientMessageId: string },
  ): Promise<{ ok: boolean; data?: ChatMessageEvent; error?: string }> {
    const userId = (client.data as SocketData).userId;

    try {
      const msg = await this.chat.sendMessage(userId, payload.conversationId, payload.body);
      // Broadcast to all sockets in the conversation.
      this.server.to(`conversation:${payload.conversationId}`).emit('chat:received', msg);
      return { ok: true, data: msg };
    } catch (err) {
      this.logger.error(`chat:send failed: ${err}`);
      return { ok: false, error: String(err) };
    }
  }

  /**
   * Client: join an event to receive poll/RSVP updates.
   */
  @SubscribeMessage('event:join')
  async handleEventJoin(
    @ConnectedSocket() client: Socket,
    @MessageBody() payload: { eventId: string },
  ): Promise<{ ok: boolean; error?: string }> {
    client.join(`event:${payload.eventId}`);
    (client.data as SocketData).rooms.add(`event:${payload.eventId}`);
    return { ok: true };
  }

  /**
   * Client: leave an event.
   */
  @SubscribeMessage('event:leave')
  handleEventLeave(
    @ConnectedSocket() client: Socket,
    @MessageBody() payload: { eventId: string },
  ): { ok: boolean } {
    client.leave(`event:${payload.eventId}`);
    (client.data as SocketData).rooms.delete(`event:${payload.eventId}`);
    return { ok: true };
  }

  // ─── Server-initiated emits (called by services) ───────────────────────────────────

  /**
   * Emit a level-up notification to a user.
   * Called by GamificationService after XP award and level calculation.
   */
  emitLevelUp(userId: string, evt: LevelUpEvent): void {
    if (!this.server) {
      this.logger.warn('emitLevelUp skipped: server not ready');
      return;
    }
    this.server.to(`user:${userId}`).emit('level:up', evt);
  }

  /**
   * Emit a gift received notification.
   * Called by GiftsService after delivery.
   */
  emitGiftReceived(userId: string, evt: GiftReceivedEvent): void {
    if (!this.server) {
      this.logger.warn('emitGiftReceived skipped: server not ready');
      return;
    }
    this.server.to(`user:${userId}`).emit('gift:received', evt);
  }

  /**
   * Emit a challenge completed notification.
   * Called by ChallengesService after completion.
   */
  emitChallengeCompleted(userId: string, evt: ChallengeCompletedEvent): void {
    if (!this.server) {
      this.logger.warn('emitChallengeCompleted skipped: server not ready');
      return;
    }
    this.server.to(`user:${userId}`).emit('challenge:completed', evt);
  }

  /**
   * Emit a friend request notification.
   * Called by FriendsNotifyService.
   */
  emitFriendRequest(userId: string, evt: FriendRequestEvent): void {
    if (!this.server) {
      this.logger.warn('emitFriendRequest skipped: server not ready');
      return;
    }
    this.server.to(`user:${userId}`).emit('friend:request', evt);
  }

  /**
   * Emit a friend request accepted notification.
   * Called by FriendsNotifyService.
   */
  emitFriendAccepted(userId: string, evt: FriendAcceptedEvent): void {
    if (!this.server) {
      this.logger.warn('emitFriendAccepted skipped: server not ready');
      return;
    }
    this.server.to(`user:${userId}`).emit('friend:accepted', evt);
  }

  /**
   * Emit location share session ended.
   * Called by LocationShareSweepService.
   */
  emitLocationShareEnded(
    conversationId: string,
    sessionId: string,
    reason: string,
    endedAt: string,
  ): void {
    if (!this.server) {
      this.logger.warn('emitLocationShareEnded skipped: server not ready');
      return;
    }
    this.server.to(`conversation:${conversationId}`).emit('location:share:ended', {
      sessionId,
      reason,
      endedAt,
    });
  }

  /**
   * Emit verification status update (admin).
   * Called by VerificationService.
   */
  emitVerificationProgress(userId: string, evt: VerificationProgressEvent): void {
    if (!this.server) {
      this.logger.warn('emitVerificationProgress skipped: server not ready');
      return;
    }
    this.server.to(`user:${userId}`).emit('verification:progress', evt);
  }

  /**
   * Get the number of connected clients (for health checks).
   */
  getConnectedCount(): number {
    return this.server?.engine?.clientsCount ?? 0;
  }
}
