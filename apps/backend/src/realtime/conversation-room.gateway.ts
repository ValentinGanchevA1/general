import { UseGuards, UsePipes, ValidationPipe } from '@nestjs/common';
import {
  ConnectedSocket,
  MessageBody,
  SubscribeMessage,
  WebSocketGateway,
} from '@nestjs/websockets';
import type {
  AckResult,
  ClientToServerEvents,
  ServerToClientEvents,
  SocketData,
} from '@g88/shared';
import type { Socket } from 'socket.io';

import { corsOrigins } from '../common/cors-origins';
import { ConversationJoinDto } from './realtime.dto';
import { WsJwtGuard } from './ws-jwt.guard';

type G88Socket = Socket<
  ClientToServerEvents,
  ServerToClientEvents,
  Record<string, never>,
  SocketData
>;

/**
 * Symmetric teardown for connection-scoped chat rooms.
 * Kept separate from the main gateway so room-release lifecycle stays small and auditable.
 */
@WebSocketGateway({
  namespace: '/realtime',
  cors: {
    origin: corsOrigins(),
    credentials: true,
  },
})
export class ConversationRoomGateway {
  @SubscribeMessage('conversation:leave')
  @UseGuards(WsJwtGuard)
  @UsePipes(new ValidationPipe({ whitelist: true, transform: true }))
  onConversationLeave(
    @ConnectedSocket() client: G88Socket,
    @MessageBody() payload: ConversationJoinDto,
  ): AckResult<{ left: true }> {
    const room = `conversation:${payload.conversationId}`;
    client.leave(room);
    client.data.rooms.delete(room);
    return { ok: true, data: { left: true } };
  }
}
