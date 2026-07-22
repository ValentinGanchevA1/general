import { WebSocketGateway, WebSocketServer, OnGatewayInit, SubscribeMessage } from '@nestjs/websockets';
import { Server } from 'socket.io';
import { Logger, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard'; // Admin guard
import { IdVerificationService } from '../id-verification.service';

@WebSocketGateway({
  namespace: '/admin',
  cors: { origin: '*' }
})
@UseGuards(JwtAuthGuard)
export class IdVerificationGateway implements OnGatewayInit {
  @WebSocketServer()
  server: Server;

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
