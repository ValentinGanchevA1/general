import { Module } from '@nestjs/common';
import { RealtimeGateway } from './realtime.gateway';
import { WsJwtGuard } from './ws-jwt.guard';
import { PresenceModule } from '../modules/presence/presence.module';
import { AuthModule } from '../modules/auth/auth.module';
import { ChatModule } from '../modules/chat/chat.module';

@Module({
  imports: [PresenceModule, AuthModule, ChatModule],
  providers: [RealtimeGateway, WsJwtGuard],
  exports: [RealtimeGateway],
})
export class RealtimeModule {}
