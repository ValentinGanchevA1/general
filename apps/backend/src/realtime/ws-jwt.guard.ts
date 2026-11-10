import { CanActivate, ExecutionContext, Injectable, Logger } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import type { Socket } from 'socket.io';

import type { JwtPayload } from '../modules/auth/jwt.strategy';
import { AdultEligibilityService } from '../modules/auth/adult-eligibility.service';
import type { SocketData } from '@g88/shared';

type AuthedSocket = Socket<Record<string, never>, Record<string, never>, Record<string, never>, SocketData>;

@Injectable()
export class WsJwtGuard implements CanActivate {
  private readonly logger = new Logger(WsJwtGuard.name);

  constructor(
    private readonly jwt: JwtService,
    private readonly adultEligibility: AdultEligibilityService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const client = context.switchToWs().getClient<AuthedSocket>();
    const token = client.handshake.auth?.['token'] as string | undefined;

    if (!token) {
      client.disconnect(true);
      return false;
    }

    try {
      // Revalidate on every incoming event, not only the first handshake.
      const payload = this.jwt.verify<JwtPayload>(token, {
        secret: process.env.JWT_SECRET!,
      });
      if (!payload?.sub) throw new Error('Missing authenticated user');
      await this.adultEligibility.assertEligible(payload.sub);
      client.data.userId = payload.sub;
      return true;
    } catch {
      // Never send authentication or DOB details over the websocket.
      this.logger.warn('WS token or adult eligibility rejected');
      client.disconnect(true);
      return false;
    }
  }
}
