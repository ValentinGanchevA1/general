import { Module } from '@nestjs/common';
import { DiscoveryService } from './discovery.service';
import { DiscoveryController } from './discovery.controller';
import { PresenceModule } from '../presence/presence.module';
import { FriendsModule } from '../friends/friends.module';

@Module({
  imports: [PresenceModule, FriendsModule],
  providers: [DiscoveryService],
  controllers: [DiscoveryController],
  // Realtime delta producers must reuse this service rather than reimplementing
  // viewer-specific discovery visibility/privacy rules.
  exports: [DiscoveryService],
})
export class DiscoveryModule {}
