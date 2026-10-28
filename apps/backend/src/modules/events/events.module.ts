import { EventReviewsService } from './event-reviews.service';
import { EventReviewsController, AdminEventReviewsController } from './event-reviews.controller';
import { Module } from '@nestjs/common';
import { EventsController } from './events.controller';
import { EventsService } from './events.service';
import { EventPulseShareService } from './event-pulse-share.service';
import { EventsDiscoveryLifecycleService } from './events-discovery-lifecycle.service';
import { FeedModule } from '../feed/feed.module';
import { NotificationsModule } from '../notifications/notifications.module';
import { RealtimeModule } from '../../realtime/realtime.module';

@Module({
  imports: [FeedModule, NotificationsModule, RealtimeModule],
  controllers: [EventsController, EventReviewsController, AdminEventReviewsController],
  providers: [
    EventPulseShareService,
    EventReviewsService,
    EventsService,
    EventsDiscoveryLifecycleService,
  ],
})
export class EventsModule {}
