import { CanActivate, ExecutionContext, Injectable, Logger } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import type { Socket } from 'socket.io';

import type { JwtPayload } from '../modules/auth/jwt.strategy';
import type { SocketData } from '@g88/shared';

type AuthedSocket = Socket<Record<string, never>, Record<string, never>, Record<string, never>, SocketData>;

@Injectable()
export class WsJwtGuard implements CanActivate {
  private readonly logger = new Logger(WsJwtGuard.name);

  constructor(private readonly jwt: JwtService) {}

  canActivate(context: ExecutionContext): boolean {
    const client = context.switchToWs().getClient<AuthedSocket>();
    const token = client.handshake.auth?.['token'] as string | undefined;

    if (!token) {
      client.disconnect(true);
      return false;
    }

    try {
      const payload = this.jwt.verify<JwtPayload>(token, {
        secret: process.env.JWT_SECRET ?? 'dev-jwt-secret-change-in-production',
      });
      client.data.userId = payload.sub;
      return true;
    } catch (err) {
      this.logger.warn(`WS auth failed: ${err}`);
      client.disconnect(true);
      return false;
    }
  }
}
