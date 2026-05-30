import { Module } from '@nestjs/common';
import { RealtimeGateway } from './realtime.gateway';
import { WsJwtGuard } from './ws-jwt.guard';
import { PresenceModule } from '../modules/presence/presence.module';
import { AuthModule } from '../modules/auth/auth.module';
import { ChatModule } from '../modules/chat/chat.module';
import { NotificationsModule } from '../modules/notifications/notifications.module';

@Module({
  imports: [PresenceModule, AuthModule, ChatModule, NotificationsModule],
  providers: [RealtimeGateway, WsJwtGuard],
  exports: [RealtimeGateway],
})
export class RealtimeModule {}
