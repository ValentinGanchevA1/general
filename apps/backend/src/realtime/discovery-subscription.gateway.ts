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
  Viewport,
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

const MAX_VIEWPORT_SPAN_DEGREES = 15;

function longitudeSpan(viewport: Viewport): number {
  if (viewport.sw.lng <= viewport.ne.lng) {
    return viewport.ne.lng - viewport.sw.lng;
  }
  return 360 - viewport.sw.lng + viewport.ne.lng;
}

function isBoundedViewport(viewport: Viewport): boolean {
  const latitudeSpan = viewport.ne.lat - viewport.sw.lat;
  return (
    latitudeSpan >= 0 &&
    latitudeSpan <= MAX_VIEWPORT_SPAN_DEGREES &&
    longitudeSpan(viewport) <= MAX_VIEWPORT_SPAN_DEGREES
  );
}

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
    if (!isBoundedViewport(payload.viewport)) {
      return {
        ok: false,
        code: 'discovery.viewport_too_large',
        message: `Discovery viewport must span at most ${MAX_VIEWPORT_SPAN_DEGREES} degrees per axis.`,
      };
    }

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
