// apps/backend/src/modules/feed/feed.module.ts
import { Module } from '@nestjs/common';

import { AuthModule } from '../auth/auth.module';
import { FeedController } from './feed.controller';
import { FeedService } from './feed.service';
import { PulseCheckInService } from './pulse-check-in.service';
import { PulseDiscoveryFeedService } from './pulse-discovery-feed.service';

@Module({
  imports: [AuthModule],
  controllers: [FeedController],
  providers: [FeedService, PulseCheckInService, PulseDiscoveryFeedService],
})
export class FeedModule {}
