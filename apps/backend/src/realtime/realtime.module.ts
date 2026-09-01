import { Module, forwardRef } from '@nestjs/common';
import { RealtimeGateway } from './realtime.gateway';
import { WsJwtGuard } from './ws-jwt.guard';
import { LocationShareSweepService } from './location-share.sweep';
import { PresenceModule } from '../modules/presence/presence.module';
import { AuthModule } from '../modules/auth/auth.module';
import { ChatModule } from '../modules/chat/chat.module';
import { NotificationsModule } from '../modules/notifications/notifications.module';
import { ChallengesModule } from '../modules/challenges/challenges.module';
import { FriendsModule } from '../modules/friends/friends.module';

@Module({
  imports: [
    PresenceModule,
    AuthModule,
    ChatModule,
    NotificationsModule,
    forwardRef(() => ChallengesModule),
    // Bidirectional: FriendsNotifyService → RealtimeGateway; gateway → FriendsService (presence).
    forwardRef(() => FriendsModule),
  ],
  providers: [RealtimeGateway, WsJwtGuard, LocationShareSweepService],
  exports: [RealtimeGateway],
})
export class RealtimeModule {}
