import { Module, forwardRef } from '@nestjs/common';
import { DiscoveryService } from './discovery.service';
import { DiscoveryEntityResolver } from './discovery-entity-resolver.service';
import { DiscoveryController } from './discovery.controller';
import { PlaceMapDiscoveryService } from './place-map-discovery.service';
import { PresenceModule } from '../presence/presence.module';
import { FriendsModule } from '../friends/friends.module';

@Module({
  imports: [PresenceModule, forwardRef(() => FriendsModule)],
  providers: [DiscoveryService, DiscoveryEntityResolver, PlaceMapDiscoveryService],
  controllers: [DiscoveryController],
  // Realtime delta producers must reuse these viewer-safe discovery boundaries
  // rather than querying discoverable entities or presence directly.
  exports: [DiscoveryService, DiscoveryEntityResolver],
})
export class DiscoveryModule {}
