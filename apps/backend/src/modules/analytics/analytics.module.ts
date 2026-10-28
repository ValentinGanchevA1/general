import { Module } from '@nestjs/common';

import { AuthModule } from '../auth/auth.module';
import { AnalyticsController } from './analytics.controller';
import { AnalyticsService } from './analytics.service';
import { PostHogAnalyticsSink } from './posthog-analytics.sink';
import { PostHogPrivacyService } from './posthog-privacy.service';

@Module({
  imports: [AuthModule],
  controllers: [AnalyticsController],
  providers: [AnalyticsService, PostHogAnalyticsSink, PostHogPrivacyService],
  exports: [AnalyticsService],
})
export class AnalyticsModule {}
