import { WebSocketGateway, WebSocketServer, OnGatewayInit } from '@nestjs/websockets';
import { Server } from 'socket.io';
import { Logger } from '@nestjs/common';
import { IdVerificationService } from '../id-verification.service';

function getWsOrigins(): string[] {
  return (process.env.CORS_ORIGINS ?? 'http://127.0.0.1:5173,http://localhost:5173')
    .split(',')
    .map((o) => o.trim())
    .filter(Boolean);
}

@WebSocketGateway({
  namespace: '/admin',
  cors: {
    origin: getWsOrigins(),
    credentials: true,
  },
})
export class IdVerificationGateway implements OnGatewayInit {
  @WebSocketServer()
  server!: Server;

  private readonly logger = new Logger(IdVerificationGateway.name);

  constructor(private readonly verificationService: IdVerificationService) {}

  afterInit() {
    this.logger.log(`Admin WS ready. Origins: ${getWsOrigins().join(', ')}`);
  }

  emitVerificationUpdate(update: { id: string; status: string; userId: string }) {
    this.server.to('admins').emit('verification:updated', update);
    // or this.server.emit if you are not using rooms yet
  }
}
