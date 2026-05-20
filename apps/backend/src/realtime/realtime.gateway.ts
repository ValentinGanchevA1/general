import { ForbiddenException, Logger, NotFoundException, UseGuards } from '@nestjs/common';
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
  PresenceUpdatePayload,
  ChatSendPayload,
  AckResult,
  WaveReceivedEvent,
  ChatMessageEvent,
} from '@g88/shared';

import { WsJwtGuard } from './ws-jwt.guard';
import { PresenceService } from '../modules/presence/presence.service';
import { ChatService } from '../modules/chat/chat.service';

type G88Server = Server<ClientToServerEvents, ServerToClientEvents, Record<string, never>, SocketData>;
type G88Socket = Socket<ClientToServerEvents, ServerToClientEvents, Record<string, never>, SocketData>;

@WebSocketGateway({
  namespace: '/realtime',
  cors: { origin: true, credentials: true },
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
  ) {}

  // ─── Lifecycle ───────────────────────────────────────────────────────────

  async handleConnection(client: G88Socket): Promise<void> {
    const userId = client.data.userId;
    if (!userId) {
      client.disconnect(true);
      return;
    }
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
  async onPresenceUpdate(
    @ConnectedSocket() client: G88Socket,
    @MessageBody() payload: PresenceUpdatePayload,
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

      // Emit presence:delta when the user crosses a cell boundary (gap Pr1).
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
  async onConversationJoin(
    @ConnectedSocket() client: G88Socket,
    @MessageBody() payload: { conversationId: string },
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
  async onChatSend(
    @ConnectedSocket() client: G88Socket,
    @MessageBody() payload: ChatSendPayload,
  ): Promise<AckResult<ChatMessageEvent>> {
    try {
      const msg = await this.chat.persist(
        payload.conversationId,
        client.data.userId,
        payload.body,
      );

      // Fan out to everyone in the conversation room (including sender's other devices).
      this.server.to(this.conversationRoom(payload.conversationId)).emit('chat:message', msg);

      return { ok: true, data: msg };
    } catch (err) {
      const res = (err as any)?.response;
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
