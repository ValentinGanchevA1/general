import {
  WebSocketGateway,
  WebSocketServer,
  OnGatewayInit,
  OnGatewayConnection,
} from '@nestjs/websockets';
import { Server, Socket } from 'socket.io';
import { Logger } from '@nestjs/common';
import type { VerificationUpdatedEvent } from '@g88/shared';
import { corsOrigins } from '../../../common/cors-origins';

/**
 * Admin-only realtime for the ID verification queue.
 * Namespace `/admin` — clients (apps/admin useVerificationSocket) listen for
 * `verification:updated`.
 */
@WebSocketGateway({
  namespace: '/admin',
  cors: {
    origin: corsOrigins(),
    credentials: true,
  },
})
export class IdVerificationGateway implements OnGatewayInit, OnGatewayConnection {
  @WebSocketServer()
  server!: Server;

  private readonly logger = new Logger(IdVerificationGateway.name);

  afterInit() {
    this.logger.log(`Admin WS ready. CORS: ${corsOrigins().join(', ')}`);
  }

  handleConnection(client: Socket) {
    void client.join('admins');
  }

  emitVerificationUpdate(update: VerificationUpdatedEvent) {
    if (!this.server) {
      this.logger.warn('emitVerificationUpdate skipped: server not ready');
      return;
    }
    this.server.to('admins').emit('verification:updated', update);
    this.server.emit('verification:updated', update);
  }
}
