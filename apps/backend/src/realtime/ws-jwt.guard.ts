import { CanActivate, ExecutionContext, Injectable, Logger } from '@nestjs/common';
import { InjectDataSource } from '@nestjs/typeorm';
import { DataSource } from 'typeorm';
import { assertAdultAge } from '../modules/auth/adult-eligibility';
import { JwtService } from '@nestjs/jwt';
import type { Socket } from 'socket.io';

import type { JwtPayload } from '../modules/auth/jwt.strategy';
import type { SocketData } from '@g88/shared';

type AuthedSocket = Socket<Record<string, never>, Record<string, never>, Record<string, never>, SocketData>;

@Injectable()
export class WsJwtGuard implements CanActivate {
  private readonly logger = new Logger(WsJwtGuard.name);

  constructor(private readonly jwt: JwtService, @InjectDataSource() private readonly db: DataSource) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const client = context.switchToWs().getClient<AuthedSocket>();
    const token = client.handshake.auth?.['token'] as string | undefined;

    if (!token) {
      client.disconnect(true);
      return false;
    }

    try {
      const payload = this.jwt.verify<JwtPayload>(token, {
        secret: process.env.JWT_SECRET!,
      });
      await assertAdultAge(this.db, payload.sub);
      client.data.userId = payload.sub;
      return true;
    } catch (err) {
      this.logger.warn(`WS auth failed: ${err}`);
      client.disconnect(true);
      return false;
    }
  }
}
