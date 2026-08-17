import {
  ForbiddenException,
  GoneException,
  Logger,
  NotFoundException,
  UsePipes,
  ValidationPipe,
  UseGuards,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { InjectDataSource } from '@nestjs/typeorm';
import { DataSource } from 'typeorm';
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
  AchievementUnlockedEvent,
  EventPollDelta,
  EventQuestionDelta,
  EventQuestionUpvoteDelta,
  StoryNewEvent,
  LocationShareSession,
} from '@g88/shared';

import { WsJwtGuard } from './ws-jwt.guard';
import {
  ChatSendDto,
  ConversationJoinDto,
  EventRoomDto,
  LocationShareStartDto,
  LocationShareStopDto,
  LocationShareUpdateDto,
  PresenceUpdateDto,
} from './realtime.dto';
import { PresenceService } from '../modules/presence/presence.service';
import { ChatService } from '../modules/chat/chat.service';
import { LocationShareService } from '../modules/chat/location-share.service';
import { NotificationsService } from '../modules/notifications/notifications.service';
import { ChallengesService } from '../modules/challenges/challenges.service';
import { FriendsService } from '../modules/friends/friends.service';
import type { JwtPayload } from '../modules/auth/jwt.strategy';

type G88Server = Server<ClientToServerEvents, ServerToClientEvents, Record<string, never>, SocketData>;
type G88Socket = Socket<ClientToServerEvents, ServerToClientEvents, Record<string, never>, SocketData>;

const wsAllowedOrigins = (process.env.CORS_ORIGINS ?? 'http://localhost:3000')
  .split(',')
  .filter(Boolean);

function extractApiError(err: unknown): { code: string; message: string } {
  if (
    err instanceof ForbiddenException ||
    err instanceof NotFoundException ||
    err instanceof GoneException
  ) {
    const response = err.getResponse();
    if (typeof response === 'object' && response !== null) {
      const r = response as { code?: string; message?: string | string[] };
      const message = Array.isArray(r.message)
        ? r.message.join(', ')
        : (r.message ?? err.message);
      return {
        code: r.code ?? err.constructor.name,
        message,
      };
    }
  }
  if (err instanceof Error && 'response' in err) {
    const resp = (err as { response?: { code?: string; message?: string } }).response;
    if (resp?.code && resp?.message) {
      return { code: resp.code, message: resp.message };
    }
  }
  return {
    code: 'unknown_error',
    message: err instanceof Error ? err.message : String(err),
  };
}

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
    private readonly locationShare: LocationShareService,
    private readonly notifications: NotificationsService,
    private readonly challenges: ChallengesService,
    private readonly friends: FriendsService,
    private readonly jwt: JwtService,
    @InjectDataSource() private readonly db: DataSource,
  ) {}

  async handleConnection(client: G88Socket): Promise<void> {
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
    client.data.friendPresenceAnnounced = false;
    client.join(this.userRoom(userId));
    this.logger.log(`socket connected: user=${userId} sid=${client.id}`);
  }

  async handleDisconnect(client: G88Socket): Promise<void> {
    const userId = client.data.userId;
    if (!userId) return;
    const remaining = await this.server.in(this.userRoom(userId)).fetchSockets();
    const others = remaining.filter((s) => s.id !== client.id);
    if (others.length === 0) {
      await this.presence.markOffline(userId);
      if (client.data.friendPresenceAnnounced) {
        void this.notifyFriendsPresence(userId, false);
      }
    }
    this.logger.log(`socket disconnected: user=${userId} sid=${client.id}`);
  }

  @SubscribeMessage('presence:update')
  @UsePipes(new ValidationPipe({ whitelist: true, transform: true }))
  async onPresenceUpdate(
    @ConnectedSocket() client: G88Socket,
    @MessageBody() payload: PresenceUpdateDto,
  ): Promise<AckResult<{ cellId: string }>> {
    try {
      const result = await this.presence.heartbeat(client.data.userId, payload.location);
      const newRoom = this.cellRoom(result.cellId);

      for (const room of client.data.rooms) {
        if (room.startsWith('cell:')) {
          client.leave(room);
          client.data.rooms.delete(room);
        }
      }
      client.join(newRoom);
      client.data.rooms.add(newRoom);

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

      if (!client.data.friendPresenceAnnounced) {
        client.data.friendPresenceAnnounced = true;
        void this.notifyFriendsPresence(client.data.userId, true);
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

  @SubscribeMessage('event:join')
  @UsePipes(new ValidationPipe({ whitelist: true, transform: true }))
  async onEventJoin(
    @ConnectedSocket() client: G88Socket,
    @MessageBody() payload: EventRoomDto,
  ): Promise<AckResult<{ joined: true }>> {
    try {
      const [event] = (await this.db.query(
        `SELECT host_id, visibility FROM events WHERE id = $1 AND deleted_at IS NULL`,
        [payload.eventId],
      )) as Array<{ host_id: string; visibility: 'public' | 'private' }>;
      if (!event || (event.visibility === 'private' && event.host_id !== client.data.userId)) {
        return { ok: false, code: 'event.not_found', message: 'Event not found' };
      }
      const room = this.eventRoom(payload.eventId);
      client.join(room);
      client.data.rooms.add(room);
      return { ok: true, data: { joined: true } };
    } catch (err) {
      this.logger.error(`event:join failed: ${err}`);
      return { ok: false, code: 'event.failed', message: 'Could not join event' };
    }
  }

  @SubscribeMessage('event:leave')
  @UsePipes(new ValidationPipe({ whitelist: true, transform: true }))
  async onEventLeave(
    @ConnectedSocket() client: G88Socket,
    @MessageBody() payload: EventRoomDto,
  ): Promise<AckResult<{ left: true }>> {
    const room = this.eventRoom(payload.eventId);
    client.leave(room);
    client.data.rooms.delete(room);
    return { ok: true, data: { left: true } };
  }

  @SubscribeMessage('chat:send')
  @UsePipes(new ValidationPipe({ whitelist: true, transform: true }))
  async onChatSend(
    @ConnectedSocket() client: G88Socket,
    @MessageBody() payload: ChatSendDto,
  ): Promise<AckResult<ChatMessageEvent>> {
    if (!client.rooms.has(this.conversationRoom(payload.conversationId))) {
      return { ok: false, code: 'chat.forbidden', message: 'Join the conversation first' };
    }

    try {
      const msg = await this.chat.persist(
        payload.conversationId,
        client.data.userId,
        payload.body,
      );

      this.server.to(this.conversationRoom(payload.conversationId)).emit('chat:message', msg);
      void this.pushToOfflineParticipants(payload.conversationId, client.data.userId, msg.body);
      void this.challenges
        .increment(client.data.userId, 'chat_sent')
        .catch((err) => this.logger.error(`challenge chat_sent failed: ${err}`));

      return { ok: true, data: msg };
    } catch (err) {
      const { code, message } = extractApiError(err);
      if (!(err instanceof ForbiddenException) && !(err instanceof NotFoundException)) {
        this.logger.error(`chat:send failed: ${err}`);
      }
      return { ok: false, code: code === 'unknown_error' ? 'chat.failed' : code, message };
    }
  }

  @SubscribeMessage('location:share:start')
  @UsePipes(new ValidationPipe({ whitelist: true, transform: true }))
  async onLocationShareStart(
    @ConnectedSocket() client: G88Socket,
    @MessageBody() payload: LocationShareStartDto,
  ): Promise<AckResult<LocationShareSession>> {
    if (!client.rooms.has(this.conversationRoom(payload.conversationId))) {
      return { ok: false, code: 'chat.forbidden', message: 'Join the conversation first' };
    }

    try {
      const { session, message } = await this.locationShare.start(
        client.data.userId,
        payload.conversationId,
        payload.duration,
        payload.location,
      );

      const room = this.conversationRoom(payload.conversationId);
      this.server.to(room).emit('location:share:started', { session, message });
      this.server.to(room).emit('chat:message', message);
      void this.pushToOfflineParticipants(
        payload.conversationId,
        client.data.userId,
        message.body,
      );

      return { ok: true, data: session };
    } catch (err) {
      const { code, message } = extractApiError(err);
      if (
        !(err instanceof ForbiddenException) &&
        !(err instanceof NotFoundException) &&
        !(err instanceof GoneException)
      ) {
        this.logger.error(`location:share:start failed: ${err}`);
      }
      return {
        ok: false,
        code: code === 'unknown_error' ? 'location.failed' : code,
        message,
      };
    }
  }

  @SubscribeMessage('location:share:update')
  @UsePipes(new ValidationPipe({ whitelist: true, transform: true }))
  async onLocationShareUpdate(
    @ConnectedSocket() client: G88Socket,
    @MessageBody() payload: LocationShareUpdateDto,
  ): Promise<AckResult<{ updatedAt: string }>> {
    try {
      const { updatedAt, conversationId } = await this.locationShare.update(
        client.data.userId,
        payload.sessionId,
        payload.location,
      );

      this.server.to(this.conversationRoom(conversationId)).emit('location:share:update', {
        sessionId: payload.sessionId,
        conversationId,
        location: payload.location,
        updatedAt,
      });

      return { ok: true, data: { updatedAt } };
    } catch (err) {
      const { code, message } = extractApiError(err);
      if (
        !(err instanceof ForbiddenException) &&
        !(err instanceof NotFoundException) &&
        !(err instanceof GoneException)
      ) {
        this.logger.error(`location:share:update failed: ${err}`);
      }
      return {
        ok: false,
        code: code === 'unknown_error' ? 'location.failed' : code,
        message,
      };
    }
  }

  @SubscribeMessage('location:share:stop')
  @UsePipes(new ValidationPipe({ whitelist: true, transform: true }))
  async onLocationShareStop(
    @ConnectedSocket() client: G88Socket,
    @MessageBody() payload: LocationShareStopDto,
  ): Promise<AckResult<{ ended: true }>> {
    try {
      const { conversationId, endedAt } = await this.locationShare.stop(
        client.data.userId,
        payload.sessionId,
      );

      this.server.to(this.conversationRoom(conversationId)).emit('location:share:ended', {
        sessionId: payload.sessionId,
        conversationId,
        reason: 'stopped',
        endedAt,
      });

      return { ok: true, data: { ended: true } };
    } catch (err) {
      const { code, message } = extractApiError(err);
      if (
        !(err instanceof ForbiddenException) &&
        !(err instanceof NotFoundException) &&
        !(err instanceof GoneException)
      ) {
        this.logger.error(`location:share:stop failed: ${err}`);
      }
      return {
        ok: false,
        code: code === 'unknown_error' ? 'location.failed' : code,
        message,
      };
    }
  }

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

  async emitAchievementUnlocked(toUserId: string, evt: AchievementUnlockedEvent): Promise<void> {
    this.server.to(this.userRoom(toUserId)).emit('achievement:unlocked', evt);
  }

  emitEventPoll(delta: EventPollDelta): void {
    this.server.to(this.eventRoom(delta.eventId)).emit('event:poll', delta);
  }

  emitEventQuestion(delta: EventQuestionDelta): void {
    this.server.to(this.eventRoom(delta.eventId)).emit('event:question', delta);
  }

  emitEventQuestionUpvote(delta: EventQuestionUpvoteDelta): void {
    this.server.to(this.eventRoom(delta.eventId)).emit('event:question:upvote', delta);
  }

  emitStoryNew(evt: StoryNewEvent): void {
    this.server.to(this.cellRoom(evt.cellId)).emit('story:new', evt);
  }

  emitLocationShareEnded(
    conversationId: string,
    sessionId: string,
    reason: 'expired' | 'timeout' | 'blocked' | 'conversation_closed',
    endedAt: string,
  ): void {
    this.server.to(this.conversationRoom(conversationId)).emit('location:share:ended', {
      sessionId,
      conversationId,
      reason,
      endedAt,
    });
  }

  /** Notify each close friend that `userId` went online/offline. */
  private async notifyFriendsPresence(userId: string, online: boolean): Promise<void> {
    try {
      // Privacy: never broadcast online when the user opted out.
      if (online && !(await this.friends.friendsSeeOnlineStatus(userId))) {
        return;
      }
      const friendIds = await this.friends.listFriendIds(userId);
      for (const friendId of friendIds) {
        this.server.to(this.userRoom(friendId)).emit('friend:presence', {
          userId,
          online,
        });
      }
    } catch (err) {
      this.logger.error(`notifyFriendsPresence failed user=${userId}: ${err}`);
    }
  }

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

  private userRoom(userId: string): string {
    return `user:${userId}`;
  }
  private cellRoom(cellId: string): string {
    return `cell:${cellId}`;
  }
  private conversationRoom(convoId: string): string {
    return `convo:${convoId}`;
  }
  private eventRoom(eventId: string): string {
    return `event:${eventId}`;
  }
}
