import { ForbiddenException, Logger, NotFoundException, UsePipes, ValidationPipe, UseGuards } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import {
  ConnectedSocket,
  MessageBody,
  OnGatewayConnection,
  OnGatewayDisconnect,
  SubscribeMessage,
  WebSocketGateway,
  WebSocketServer,
} from '@nestjs/websockets';
import { Server, Socket } from 'socket.io';

import type {
  ClientToServerEvents,
  ServerToClientEvents,
  SocketData,
  AckResult,
  WaveReceivedEvent,
  ChatMessageEvent,
  GiftReceivedEvent,
} from '@g88/shared';

import { WsJwtGuard } from './ws-jwt.guard';
import { ChatSendDto, ConversationJoinDto, PresenceUpdateDto } from './realtime.dto';
import { PresenceService } from '../modules/presence/presence.service';
import { ChatService } from '../modules/chat/chat.service';
import { NotificationsService } from '../modules/notifications/notifications.service';
import { ChallengesService } from '../modules/challenges/challenges.service';
import type { JwtPayload } from '../modules/auth/jwt.strategy';

type G88Server = Server<ClientToServerEvents, ServerToClientEvents, Record<string, never>, SocketData>;
type G88Socket = Socket<ClientToServerEvents, ServerToClientEvents, Record<string, never>, SocketData>;

const wsAllowedOrigins = (process.env.CORS_ORIGINS ?? 'http://localhost:3000')
  .split(',')
  .filter(Boolean);

@WebSocketGateway({
  namespace: '/realtime',
  cors: { origin: wsAllowedOrigins, credentials: true },
  connectionStateRecovery: {
    maxDisconnectionDuration: 2 * 60 * 1000,
    skipMiddlewares: true,
  },
})
@UseGuards(WsJwtGuard)
export class RealtimeGateway implements OnGatewayConnection, OnGatewayDisconnect {
  private readonly logger = new Logger(RealtimeGateway.name);

  @WebSocketServer()
  server!: G88Server;

  constructor(
    private readonly presence: PresenceService,
    private readonly chat: ChatService,
    private readonly notifications: NotificationsService,
    private readonly challenges: ChallengesService,
    private readonly jwt: JwtService,
  ) {}

  // ─── Lifecycle ───────────────────────────────────────────────────────────

  async handleConnection(client: G88Socket): Promise<void> {
    // Guards don't run for lifecycle hooks — verify the token here directly.
    const token = client.handshake.auth?.['token'] as string | undefined;
    if (!token) {
      client.disconnect(true);
      return;
    }
    try {
      const payload = this.jwt.verify<JwtPayload>(token, { secret: process.env.JWT_SECRET! });
      client.data.userId = payload.sub;
    } catch {
      client.disconnect(true);
      return;
    }

    const userId = client.data.userId;
    client.data.rooms = new Set();
    client.join(this.userRoom(userId));
    this.logger.log(`socket connected: user=${userId} sid=${client.id}`);
  }

  async handleDisconnect(client: G88Socket): Promise<void> {
    const userId = client.data.userId;
    if (!userId) return;
    const remaining = await this.server.in(this.userRoom(userId)).fetchSockets();
    if (remaining.length === 0) {
      await this.presence.markOffline(userId);
    }
    this.logger.log(`socket disconnected: user=${userId} sid=${client.id}`);
  }

  // ─── Inbound events ──────────────────────────────────────────────────────

  @SubscribeMessage('presence:update')
  @UsePipes(new ValidationPipe({ whitelist: true, transform: true }))
  async onPresenceUpdate(
    @ConnectedSocket() client: G88Socket,
    @MessageBody() payload: PresenceUpdateDto,
  ): Promise<AckResult<{ cellId: string }>> {
    try {
      const result = await this.presence.heartbeat(client.data.userId, payload.location);
      const newRoom = this.cellRoom(result.cellId);

      // Swap socket into the right cell room.
      for (const room of client.data.rooms) {
        if (room.startsWith('cell:')) {
          client.leave(room);
          client.data.rooms.delete(room);
        }
      }
      client.join(newRoom);
      client.data.rooms.add(newRoom);

      // Emit presence:delta when the user crosses a cell boundary.
      if (result.prevCellId) {
        this.server.to(this.cellRoom(result.prevCellId)).emit('presence:delta', {
          cellId: result.prevCellId,
          added: [],
          removed: [client.data.userId],
        });
        this.server.to(newRoom).emit('presence:delta', {
          cellId: result.cellId,
          added: [{ userId: client.data.userId, lat: result.lat, lng: result.lng }],
          removed: [],
        });
      }

      return { ok: true, data: { cellId: result.cellId } };
    } catch (err) {
      this.logger.error(`presence:update failed: ${err}`);
      return { ok: false, code: 'presence.failed', message: 'Could not update presence' };
    }
  }

  @SubscribeMessage('conversation:join')
  @UsePipes(new ValidationPipe({ whitelist: true, transform: true }))
  async onConversationJoin(
    @ConnectedSocket() client: G88Socket,
    @MessageBody() payload: ConversationJoinDto,
  ): Promise<AckResult<{ joined: true }>> {
    try {
      const ok = await this.chat.isParticipant(payload.conversationId, client.data.userId);
      if (!ok) {
        return { ok: false, code: 'chat.forbidden', message: 'Not a participant' };
      }
      const room = this.conversationRoom(payload.conversationId);
      client.join(room);
      client.data.rooms.add(room);
      return { ok: true, data: { joined: true } };
    } catch (err) {
      this.logger.error(`conversation:join failed: ${err}`);
      return { ok: false, code: 'chat.failed', message: 'Could not join conversation' };
    }
  }

  @SubscribeMessage('chat:send')
  @UsePipes(new ValidationPipe({ whitelist: true, transform: true }))
  async onChatSend(
    @ConnectedSocket() client: G88Socket,
    @MessageBody() payload: ChatSendDto,
  ): Promise<AckResult<ChatMessageEvent>> {
    // Enforce that the socket has joined the conversation room before sending.
    if (!client.rooms.has(this.conversationRoom(payload.conversationId))) {
      return { ok: false, code: 'chat.forbidden', message: 'Join the conversation first' };
    }

    try {
      const msg = await this.chat.persist(
        payload.conversationId,
        client.data.userId,
        payload.body,
      );

      // Fan out to everyone in the conversation room (including sender's other devices).
      this.server.to(this.conversationRoom(payload.conversationId)).emit('chat:message', msg);

      // Push to participants who have no active socket connection.
      void this.pushToOfflineParticipants(payload.conversationId, client.data.userId, msg.body);

      // Challenge progress: "send messages" quests.
      void this.challenges
        .increment(client.data.userId, 'chat_sent')
        .catch((err) => this.logger.error(`challenge chat_sent failed: ${err}`));

      return { ok: true, data: msg };
    } catch (err) {
      const res = (err as { response?: { code?: string; message?: string } })?.response;
      const code = res?.code ?? 'chat.failed';
      const message = res?.message ?? (err instanceof Error ? err.message : 'Unknown error');
      if (!(err instanceof ForbiddenException) && !(err instanceof NotFoundException)) {
        this.logger.error(`chat:send failed: ${err}`);
      }
      return { ok: false, code, message };
    }
  }

  // ─── Outbound APIs (called by other services) ────────────────────────────

  async emitWaveReceived(toUserId: string, evt: WaveReceivedEvent): Promise<void> {
    this.server.to(this.userRoom(toUserId)).emit('wave:received', evt);
  }

  async emitConversationOpened(
    conversationId: string,
    participantIds: string[],
    triggeringWaveId: string,
  ): Promise<void> {
    for (const userId of participantIds) {
      this.server.to(this.userRoom(userId)).emit('conversation:opened', {
        conversationId,
        participantIds,
        triggeringWaveId,
      });
    }
  }

  /**
   * Deliver a gift to the recipient: emit live to any connected sockets, and fall
   * back to a push notification when they have none (mirrors offline chat pushes).
   */
  async emitGiftReceived(toUserId: string, evt: GiftReceivedEvent): Promise<void> {
    this.server.to(this.userRoom(toUserId)).emit('gift:received', evt);
    try {
      const sockets = await this.server.in(this.userRoom(toUserId)).fetchSockets();
      if (sockets.length === 0) {
        await this.notifications.notifyGift(
          toUserId,
          evt.sender.displayName,
          evt.emoji,
          evt.label,
        );
      }
    } catch (err) {
      this.logger.error(`emitGiftReceived push failed: ${err}`);
    }
  }

  // ─── Push helpers ────────────────────────────────────────────────────────

  private async pushToOfflineParticipants(
    conversationId: string,
    senderId: string,
    body: string,
  ): Promise<void> {
    try {
      const participantIds = await this.chat.getParticipantIds(conversationId);
      for (const recipientId of participantIds) {
        if (recipientId === senderId) continue;
        const sockets = await this.server.in(this.userRoom(recipientId)).fetchSockets();
        if (sockets.length === 0) {
          await this.notifications.notifyMessageFrom(recipientId, senderId, body, conversationId);
        }
      }
    } catch (err) {
      this.logger.error(`pushToOfflineParticipants failed: ${err}`);
    }
  }

  // ─── Room naming ─────────────────────────────────────────────────────────

  private userRoom(userId: string): string {
    return `user:${userId}`;
  }
  private cellRoom(cellId: string): string {
    return `cell:${cellId}`;
  }
  private conversationRoom(convoId: string): string {
    return `convo:${convoId}`;
  }
}
