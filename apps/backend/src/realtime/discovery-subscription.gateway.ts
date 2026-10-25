import { UseGuards, UsePipes, ValidationPipe } from '@nestjs/common';
import {
  ConnectedSocket,
  MessageBody,
  OnGatewayDisconnect,
  SubscribeMessage,
  WebSocketGateway,
} from '@nestjs/websockets';
import type { Socket } from 'socket.io';
import type {
  AckResult,
  ClientToServerEvents,
  ServerToClientEvents,
  SocketData,
} from '@g88/shared';

import { corsOrigins } from '../common/cors-origins';
import { DiscoverySubscriptionStore } from './discovery-subscription.store';
import { DiscoverySubscriptionDto } from './realtime.dto';
import { WsJwtGuard } from './ws-jwt.guard';

type G88Socket = Socket<
  ClientToServerEvents,
  ServerToClientEvents,
  Record<string, never>,
  SocketData
>;

/**
 * Owns only the discovery subscription lifecycle on the shared realtime
 * namespace. Entity fan-out remains a separate privacy-authorized pipeline.
 */
@WebSocketGateway({
  namespace: '/realtime',
  cors: {
    origin: corsOrigins(),
    credentials: true,
  },
})
export class DiscoverySubscriptionGateway implements OnGatewayDisconnect {
  constructor(private readonly subscriptions: DiscoverySubscriptionStore) {}

  @SubscribeMessage('discovery:subscribe')
  @UseGuards(WsJwtGuard)
  @UsePipes(new ValidationPipe({ whitelist: true, transform: true }))
  onSubscribe(
    @ConnectedSocket() client: G88Socket,
    @MessageBody() payload: DiscoverySubscriptionDto,
  ): AckResult<{ subscribed: true }> {
    this.subscriptions.set(client.id, client.data.userId, payload);
    return { ok: true, data: { subscribed: true } };
  }

  @SubscribeMessage('discovery:unsubscribe')
  @UseGuards(WsJwtGuard)
  onUnsubscribe(
    @ConnectedSocket() client: G88Socket,
  ): AckResult<{ unsubscribed: true }> {
    this.subscriptions.delete(client.id);
    return { ok: true, data: { unsubscribed: true } };
  }

  handleDisconnect(client: G88Socket): void {
    this.subscriptions.delete(client.id);
  }
}
