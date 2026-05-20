import { Module } from '@nestjs/common';
import { InteractionsService } from './interactions.service';
import { InteractionsController } from './interactions.controller';
import { RealtimeModule } from '../../realtime/realtime.module';
import { NotificationsModule } from '../notifications/notifications.module';

@Module({
  imports: [RealtimeModule, NotificationsModule],
  providers: [InteractionsService],
  controllers: [InteractionsController],
})
export class InteractionsModule {}
