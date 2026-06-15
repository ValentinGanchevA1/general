import { Module } from '@nestjs/common';
import { EventsController } from './events.controller';
import { EventsService } from './events.service';
import { NotificationsModule } from '../notifications/notifications.module';
import { RealtimeModule } from '../../realtime/realtime.module';

@Module({
  imports: [NotificationsModule, RealtimeModule],
  controllers: [EventsController],
  providers: [EventsService],
})
export class EventsModule {}
