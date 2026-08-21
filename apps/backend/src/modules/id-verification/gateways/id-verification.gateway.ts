import {
  WebSocketGateway,
  WebSocketServer,
  OnGatewayInit,
  OnGatewayConnection,
} from '@nestjs/websockets';
import { Server, Socket } from 'socket.io';
import { Logger } from '@nestjs/common';
import type { VerificationUpdatedEvent } from '@g88/shared';

function getWsOrigins(): string[] {
  return (process.env.CORS_ORIGINS ?? 'http://127.0.0.1:5173,http://localhost:5173')
    .split(',')
    .map((o) => o.trim())
    .filter(Boolean);
}

/**
 * Admin-only realtime for the ID verification queue.
 * Namespace `/admin` — clients (apps/admin useVerificationSocket) listen for
 * `verification:updated`. No room join required; emit is namespace-wide.
 */
@WebSocketGateway({
  namespace: '/admin',
  cors: {
    origin: getWsOrigins(),
    credentials: true,
  },
})
export class IdVerificationGateway implements OnGatewayInit, OnGatewayConnection {
  @WebSocketServer()
  server!: Server;

  private readonly logger = new Logger(IdVerificationGateway.name);

  afterInit() {
    this.logger.log(`Admin WS ready. Origins: ${getWsOrigins().join(', ')}`);
  }

  handleConnection(client: Socket) {
    // Optional room for future targeting; emit also goes namespace-wide below.
    void client.join('admins');
  }

  emitVerificationUpdate(update: VerificationUpdatedEvent) {
    if (!this.server) {
      this.logger.warn('emitVerificationUpdate skipped: server not ready');
      return;
    }
    this.server.to('admins').emit('verification:updated', update);
    // Fallback for clients that never joined the room (first paint / reconnect).
    this.server.emit('verification:updated', update);
  }
}
