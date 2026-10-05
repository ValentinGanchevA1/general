import {
  ForbiddenException,
  GoneException,
  Inject,
  Logger,
  NotFoundException,
  UseGuards,
  UsePipes,
  ValidationPipe,
  forwardRef,
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
  LevelUpEvent,
  ChallengeCompletedEvent,
  LeaderboardRankUpEvent,
  EventPollDelta,
  EventQuestionDelta,
  EventQuestionUpvoteDelta,
  StoryNewEvent,
  LocationShareSession,
  FriendRequestEvent,
  FriendAcceptedEvent,
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
import { corsOrigins } from '../common/cors-origins';

type G88Server = Server<ClientToServerEvents, ServerToClientEvents, Record<string, never>, SocketData>;
type G88Socket = Socket<ClientToServerEvents, ServerToClientEvents, Record<string, never>, SocketData>;

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
      return { code: r.code ?? 'forbidden', message };
    }
  }
  if (err instanceof Error) {
    return { code: 'unknown_error', message: err.message };
  }
  return { code: 'unknown_error', message: String(err) };
}

@WebSocketGateway({
  namespace: '/realtime',
  cors: {
    origin: corsOrigins(),
    credentials: true,
  },
})
export class RealtimeGateway implements OnGatewayConnection, OnGatewayDisconnect {
  @WebSocketServer()
  server!: G88Server;

  private readonly logger = new Logger(RealtimeGateway.name);

  constructor(
    private readonly jwt: JwtService,
    private readonly presence: PresenceService,
    private readonly chat: ChatService,
    private readonly locationShare: LocationShareService,
    private readonly notifications: NotificationsService,
    private readonly friends: FriendsService,
    @Inject(forwardRef(() => ChallengesService))
    private readonly challenges: ChallengesService,
    @InjectDataSource() private readonly db: DataSource,
  ) {}

  async handleConnection(client: G88Socket): Promise<void> {
    try {
      const token =
        (client.handshake.auth?.token as string | undefined) ||
        (client.handshake.headers?.authorization?.replace(/^Bearer\s+/i, '') as string | undefined);
      if (!token) {
        client.disconnect(true);
        return;
      }
      const payload = this.jwt.verify<JwtPayload>(token);
      if (!payload?.sub) {
        client.disconnect(true);
        return;
      }
      client.data = {
        userId: payload.sub,
        rooms: new Set(),
      };
      client.join(this.userRoom(payload.sub));
      await this.presence.setOnline(payload.sub, true);
      void this.notifyFriendsPresence(payload.sub, true);
      this.logger.debug(`connected user=${payload.sub}`);
    } catch (err) {
      this.logger.warn(`connect rejected: ${err}`);
      client.disconnect(true);
    }
  }

  async handleDisconnect(client: G88Socket): Promise<void> {
    const userId = client.data?.userId;
    if (!userId) return;
    try {
      await this.presence.setOnline(userId, false);
      void this.notifyFriendsPresence(userId, false);
    } catch (err) {
      this.logger.error(`disconnect cleanup failed user=${userId}: ${err}`);
    }
  }

  @UseGuards(WsJwtGuard)
  @UsePipes(new ValidationPipe({ transform: true, whitelist: true }))
  @SubscribeMessage('presence:update')
  async onPresenceUpdate(
    @ConnectedSocket() client: G88Socket,
    @MessageBody() body: PresenceUpdateDto,
  ): Promise<AckResult> {
    const userId = client.data.userId;
    try {
      const cell = await this.presence.updateLocation(userId, body.location);
      if (cell) {
        client.join(this.cellRoom(cell));
        this.server.to(this.cellRoom(cell)).emit('presence:nearby', {
          userId,
          location: body.location,
          timestamp: new Date().toISOString(),
        });
      }
      return { ok: true };
    } catch (err) {
      const { code, message } = extractApiError(err);
      return { ok: false, code, message };
    }
  }

  @UseGuards(WsJwtGuard)
  @UsePipes(new ValidationPipe({ transform: true, whitelist: true }))
  @SubscribeMessage('conversation:join')
  async onConversationJoin(
    @ConnectedSocket() client: G88Socket,
    @MessageBody() body: ConversationJoinDto,
  ): Promise<AckResult> {
    const userId = client.data.userId;
    try {
      await this.chat.assertParticipant(userId, body.conversationId);
      client.join(this.conversationRoom(body.conversationId));
      client.data.rooms.add(this.conversationRoom(body.conversationId));
      return { ok: true };
    } catch (err) {
      const { code, message } = extractApiError(err);
      return { ok: false, code, message };
    }
  }

  @UseGuards(WsJwtGuard)
  @UsePipes(new ValidationPipe({ transform: true, whitelist: true }))
  @SubscribeMessage('event:join')
  async onEventJoin(
    @ConnectedSocket() client: G88Socket,
    @MessageBody() body: EventRoomDto,
  ): Promise<AckResult> {
    client.join(this.eventRoom(body.eventId));
    client.data.rooms.add(this.eventRoom(body.eventId));
    return { ok: true };
  }

  @UseGuards(WsJwtGuard)
  @UsePipes(new ValidationPipe({ transform: true, whitelist: true }))
  @SubscribeMessage('event:leave')
  async onEventLeave(
    @ConnectedSocket() client: G88Socket,
    @MessageBody() body: EventRoomDto,
  ): Promise<AckResult> {
    client.leave(this.eventRoom(body.eventId));
    client.data.rooms.delete(this.eventRoom(body.eventId));
    return { ok: true };
  }

  @UseGuards(WsJwtGuard)
  @UsePipes(new ValidationPipe({ transform: true, whitelist: true }))
  @SubscribeMessage('chat:send')
  async onChatSend(
    @ConnectedSocket() client: G88Socket,
    @MessageBody() body: ChatSendDto,
  ): Promise<AckResult & { data?: ChatMessageEvent }> {
    const userId = client.data.userId;
    try {
      const msg = await this.chat.sendMessage(userId, body.conversationId, body.body, body.clientMessageId);
      this.server.to(this.conversationRoom(body.conversationId)).emit('chat:received', msg);
      void this.pushToOfflineParticipants(body.conversationId, userId, body.body);
      return { ok: true, data: msg };
    } catch (err) {
      const { code, message } = extractApiError(err);
      return { ok: false, code, message };
    }
  }

  @UseGuards(WsJwtGuard)
  @UsePipes(new ValidationPipe({ transform: true, whitelist: true }))
  @SubscribeMessage('location:share:start')
  async onLocationShareStart(
    @ConnectedSocket() client: G88Socket,
    @MessageBody() payload: LocationShareStartDto,
  ): Promise<AckResult<LocationShareSession>> {
    const userId = client.data.userId;
    try {
      const { session, message } = await this.locationShare.start(
        userId,
        payload.conversationId,
        payload.location,
        payload.ttlMinutes,
      );
      const room = this.conversationRoom(payload.conversationId);
      client.join(room);
      client.data.rooms.add(room);
      this.server.to(room).emit('location:share:started', { session, message });
      return { ok: true, data: session };
    } catch (err) {
      const { code, message } = extractApiError(err);
      if (code === 'unknown_error') {
        this.logger.error(`location:share:start failed: ${err}`);
      }
      return { ok: false, code, message };
    }
  }

  @UseGuards(WsJwtGuard)
  @UsePipes(new ValidationPipe({ transform: true, whitelist: true }))
  @SubscribeMessage('location:share:update')
  async onLocationShareUpdate(
    @ConnectedSocket() client: G88Socket,
    @MessageBody() payload: LocationShareUpdateDto,
  ): Promise<AckResult> {
    const userId = client.data.userId;
    try {
      const { updatedAt, conversationId } = await this.locationShare.update(
        userId,
        payload.sessionId,
        payload.location,
      );
      this.server.to(this.conversationRoom(conversationId)).emit('location:share:update', {
        sessionId: payload.sessionId,
        conversationId,
        location: payload.location,
        updatedAt,
      });
      return { ok: true };
    } catch (err) {
      const { code, message } = extractApiError(err);
      if (code === 'unknown_error') {
        this.logger.error(`location:share:update failed: ${err}`);
      }
      return { ok: false, code, message };
    }
  }

  @UseGuards(WsJwtGuard)
  @UsePipes(new ValidationPipe({ transform: true, whitelist: true }))
  @SubscribeMessage('location:share:stop')
  async onLocationShareStop(
    @ConnectedSocket() client: G88Socket,
    @MessageBody() payload: LocationShareStopDto,
  ): Promise<AckResult> {
    const userId = client.data.userId;
    try {
      const { conversationId, endedAt } = await this.locationShare.stop(
        userId,
        payload.sessionId,
      );
      this.server.to(this.conversationRoom(conversationId)).emit('location:share:ended', {
        sessionId: payload.sessionId,
        conversationId,
        reason: 'user_stopped' as const,
        endedAt,
      });
      return { ok: true };
    } catch (err) {
      const { code, message } = extractApiError(err);
      if (code === 'unknown_error') {
        this.logger.error(`location:share:stop failed: ${err}`);
      }
      return { ok: false, code, message };
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
  }

  async emitAchievementUnlocked(toUserId: string, evt: AchievementUnlockedEvent): Promise<void> {
    this.server.to(this.userRoom(toUserId)).emit('achievement:unlocked', evt);
  }

  async emitLevelUp(toUserId: string, evt: LevelUpEvent): Promise<void> {
    this.server.to(this.userRoom(toUserId)).emit('level:up', evt);
  }

  async emitChallengeCompleted(toUserId: string, evt: ChallengeCompletedEvent): Promise<void> {
    this.server.to(this.userRoom(toUserId)).emit('challenge:completed', evt);
  }

  async emitLeaderboardRankUp(toUserId: string, evt: LeaderboardRankUpEvent): Promise<void> {
    this.server.to(this.userRoom(toUserId)).emit('leaderboard:rank_up', evt);
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

  async emitFriendRequest(toUserId: string, evt: FriendRequestEvent): Promise<void> {
    this.server.to(this.userRoom(toUserId)).emit('friend:request', evt);
  }

  async emitFriendAccepted(toUserId: string, evt: FriendAcceptedEvent): Promise<void> {
    this.server.to(this.userRoom(toUserId)).emit('friend:accepted', evt);
  }

  async emitWaveMutual(
    toUserId: string,
    evt: {
      conversationId: string;
      waveId: string;
      createdAt: string;
      peerUserId: string;
    },
  ): Promise<void> {
    this.server.to(this.userRoom(toUserId)).emit('wave:mutual', evt);
  }

  async emitDatingMatchCreated(
    toUserId: string,
    evt: {
      peerUserId: string;
      peerDisplayName: string;
      peerAvatarUrl: string | null;
      datingConversationId: string;
      createdAt: string;
    },
  ): Promise<void> {
    this.server.to(this.userRoom(toUserId)).emit('dating:match_created', evt);
  }

  async emitDatingLikeReceived(
    toUserId: string,
    evt: {
      likeId: string;
      fromUser: {
        id: string;
        displayName: string;
        avatarUrl: string | null;
      };
      createdAt: string;
    },
  ): Promise<void> {
    this.server.to(this.userRoom(toUserId)).emit('dating:like_received', evt);
  }

  private async notifyFriendsPresence(userId: string, online: boolean): Promise<void> {
    try {
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
