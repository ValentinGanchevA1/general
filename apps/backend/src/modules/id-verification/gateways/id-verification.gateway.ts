import { Logger } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import {
  OnGatewayConnection,
  OnGatewayInit,
  WebSocketGateway,
  WebSocketServer,
} from '@nestjs/websockets';
import { Server, Socket } from 'socket.io';
import type { VerificationUpdatedEvent } from '@g88/shared';
import { corsOrigins } from '../../../common/cors-origins';
import type { JwtPayload } from '../../auth/jwt.strategy';
import { isAdminUserId } from '../admin.guard';

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

  constructor(private readonly jwt: JwtService) {}

  afterInit(): void {
    this.logger.log(`Admin WS ready. CORS: ${corsOrigins().join(', ')}`);
  }

  handleConnection(client: Socket): void {
    const token = client.handshake.auth?.['token'] as string | undefined;
    if (!token) {
      this.rejectConnection(client, 'missing token');
      return;
    }

    try {
      const payload = this.jwt.verify<JwtPayload>(token, {
        secret: process.env.JWT_SECRET!,
      });
      if (!isAdminUserId(payload.sub)) {
        this.rejectConnection(client, 'non-admin subject');
        return;
      }

      void client.join('admins');
    } catch {
      this.rejectConnection(client, 'invalid token');
    }
  }

  emitVerificationUpdate(update: VerificationUpdatedEvent): void {
    if (!this.server) {
      this.logger.warn('emitVerificationUpdate skipped: server not ready');
      return;
    }
    this.server.to('admins').emit('verification:updated', update);
  }

  private rejectConnection(client: Socket, reason: string): void {
    this.logger.warn(`Rejected admin WS connection: ${reason}`);
    client.disconnect(true);
  }
}
