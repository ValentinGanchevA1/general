import { Module, forwardRef } from '@nestjs/common';
import { RealtimeGateway } from './realtime.gateway';
import { RealtimeEmitterService } from './realtime-emitter.service';
import { WsJwtGuard } from './ws-jwt.guard';
import { LocationShareSweepService } from './location-share.sweep';
import { DiscoveryRealtimePublisher } from './discovery-realtime.publisher';
import { DiscoveryMutationBusService } from './discovery-mutation-bus.service';
import { DiscoveryPresencePublisher } from './discovery-presence.publisher';
import { DiscoverySubscriptionStore } from './discovery-subscription.store';
import { RuntimeMemoryDiagnosticsService } from './runtime-memory-diagnostics.service';
import { DiscoverySubscriptionGateway } from './discovery-subscription.gateway';
import { PresenceModule } from '../modules/presence/presence.module';
import { AuthModule } from '../modules/auth/auth.module';
import { ChatModule } from '../modules/chat/chat.module';
import { NotificationsModule } from '../modules/notifications/notifications.module';
import { ChallengesModule } from '../modules/challenges/challenges.module';
import { FriendsModule } from '../modules/friends/friends.module';
import { DiscoveryModule } from '../modules/discovery/discovery.module';

@Module({
  imports: [
    PresenceModule,
    AuthModule,
    ChatModule,
    NotificationsModule,
    forwardRef(() => DiscoveryModule),
    forwardRef(() => ChallengesModule),
    // Bidirectional: FriendsNotifyService → RealtimeGateway; gateway → FriendsService (presence).
    forwardRef(() => FriendsModule),
  ],
  providers: [
    RealtimeGateway,
    RealtimeEmitterService,
    DiscoverySubscriptionGateway,
    WsJwtGuard,
    LocationShareSweepService,
    DiscoveryRealtimePublisher,
    DiscoveryMutationBusService,
    DiscoveryPresencePublisher,
    DiscoverySubscriptionStore,
    RuntimeMemoryDiagnosticsService,
  ],
  exports: [
    RealtimeGateway,
    RealtimeEmitterService,
    DiscoveryRealtimePublisher,
    DiscoveryPresencePublisher,
    DiscoverySubscriptionStore,
  ],
})
export class RealtimeModule {}
