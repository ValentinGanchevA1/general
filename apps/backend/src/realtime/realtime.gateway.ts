import { Logger, UseGuards } from '@nestjs/common';
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
  WaveResponse,
  WaveReceivedEvent,
  ChatMessageEvent,
} from '@g88/shared';

import { WsJwtGuard } from './ws-jwt.guard';
import { PresenceService } from '../modules/presence/presence.service';

type G88Server = Server<ClientToServerEvents, ServerToClientEvents, Record<string, never>, SocketData>;
type G88Socket = Socket<ClientToServerEvents, ServerToClientEvents, Record<string, never>, SocketData>;

@WebSocketGateway({
  namespace: '/realtime',
  cors: { origin: true, credentials: true },
  // Connection state recovery means a dropped socket can re-attach within 2min
  // and replay missed events — huge UX win on mobile networks.
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

  constructor(private readonly presence: PresenceService) {}

  // ─── Lifecycle ───────────────────────────────────────────────────────────

  async handleConnection(client: G88Socket): Promise<void> {
    // WsJwtGuard populated client.data.userId at handshake.
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
    // Only mark offline if this was the user's LAST socket — they may have
    // another tab/device still connected.
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

      // Swap the user into the right cell room.
      const newRoom = this.cellRoom(result.cellId);
      for (const room of client.data.rooms) {
        if (room.startsWith('cell:')) {
          client.leave(room);
          client.data.rooms.delete(room);
        }
      }
      client.join(newRoom);
      client.data.rooms.add(newRoom);

      return { ok: true, data: result };
    } catch (err) {
      this.logger.error(`presence:update failed: ${err}`);
      return { ok: false, code: 'presence.failed', message: 'Could not update presence' };
    }
  }

  @SubscribeMessage('chat:send')
  async onChatSend(
    @ConnectedSocket() client: G88Socket,
    @MessageBody() payload: ChatSendPayload,
  ): Promise<AckResult<ChatMessageEvent>> {
    // ChatService persistence omitted in this skeleton — wired in InteractionsModule.
    // The shape below shows the contract: persist, fan out, ack with the canonical message.
    const persisted: ChatMessageEvent = {
      id: 'TODO_persisted_id',
      conversationId: payload.conversationId,
      senderId: client.data.userId,
      body: payload.body,
      createdAt: new Date().toISOString(),
    };
    this.server.to(this.conversationRoom(payload.conversationId)).emit('chat:message', persisted);
    return { ok: true, data: persisted };
  }

  // ─── Outbound APIs (called by other services) ────────────────────────────

  async emitWaveReceived(
    toUserId: string,
    wave: WaveResponse,
    context: 'map' | 'profile' | 'event',
  ): Promise<void> {
    const evt: WaveReceivedEvent = {
      waveId: wave.id,
      fromUser: {
        id: wave.fromUserId,
        // Hydrated by the InteractionsService before calling — wire up in real impl.
        displayName: '',
        avatarUrl: null,
        verification: 'none',
      },
      context,
      createdAt: wave.createdAt,
    };
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
