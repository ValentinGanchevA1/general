import { Module } from '@nestjs/common';
import { RealtimeGateway } from './realtime.gateway';
import { WsJwtGuard } from './ws-jwt.guard';
import { PresenceModule } from '../modules/presence/presence.module';
import { AuthModule } from '../modules/auth/auth.module';

@Module({
  imports: [PresenceModule, AuthModule],
  providers: [RealtimeGateway, WsJwtGuard],
  exports: [RealtimeGateway],
})
export class RealtimeModule {}
