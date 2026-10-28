// apps/backend/src/modules/feed/feed.module.ts
import { Module } from '@nestjs/common';

import { RealtimeModule } from '../../realtime/realtime.module';
import { AuthModule } from '../auth/auth.module';
import { FeedController } from './feed.controller';
import { FeedService } from './feed.service';
import { MapTilerPlaceAttestationService } from './maptiler-place-attestation.service';
import { PlaceCatalogService } from './place-catalog.service';
import { PulseActivityRealtimeService } from './pulse-activity-realtime.service';
import { PulseCheckInService } from './pulse-check-in.service';
import { PulseDiscoveryFeedService } from './pulse-discovery-feed.service';
import { PulsePlaceTrendingService } from './pulse-place-trending.service';

@Module({
  imports: [AuthModule, RealtimeModule],
  controllers: [FeedController],
  providers: [
    FeedService,
    MapTilerPlaceAttestationService,
    PlaceCatalogService,
    PulseActivityRealtimeService,
    PulseCheckInService,
    PulseDiscoveryFeedService,
    PulsePlaceTrendingService,
  ],
  exports: [PulseActivityRealtimeService],
})
export class FeedModule {}
