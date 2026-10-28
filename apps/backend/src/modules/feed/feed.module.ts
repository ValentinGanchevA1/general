// apps/backend/src/modules/feed/feed.module.ts
import { Module } from '@nestjs/common';

import { RealtimeModule } from '../../realtime/realtime.module';
import { AuthModule } from '../auth/auth.module';
import { FeedController } from './feed.controller';
import { FeedService } from './feed.service';
import { PulseActivityRealtimeService } from './pulse-activity-realtime.service';
import { PulseCheckInService } from './pulse-check-in.service';
import { PulseDiscoveryFeedService } from './pulse-discovery-feed.service';

@Module({
  imports: [AuthModule, RealtimeModule],
  controllers: [FeedController],
  providers: [
    FeedService,
    PulseActivityRealtimeService,
    PulseCheckInService,
    PulseDiscoveryFeedService,
  ],
  exports: [PulseActivityRealtimeService],
})
export class FeedModule {}
