import { WebSocketGateway, WebSocketServer, OnGatewayInit } from '@nestjs/websockets';
import { Server } from 'socket.io';
import { Logger } from '@nestjs/common';
import { IdVerificationService } from '../id-verification.service';

const wsAllowedOrigins = (process.env.CORS_ORIGINS ?? 'http://localhost:3000')
  .split(',')
  .filter(Boolean);

@WebSocketGateway({
  namespace: '/admin',
  cors: { origin: wsAllowedOrigins, credentials: true },
})
export class IdVerificationGateway implements OnGatewayInit {
  @WebSocketServer()
  server!: Server;

  private logger = new Logger('IdVerificationGateway');

  constructor(private verificationService: IdVerificationService) {}

  afterInit() {
    this.logger.log('Admin Verification WS Gateway initialized');
  }

  // Called from service after decide
  emitVerificationUpdate(update: { id: string; status: string; userId: string }) {
    this.server.emit('verification:updated', update);
  }
}
