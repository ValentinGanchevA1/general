import { Module } from '@nestjs/common';
import { NotificationsService } from './notifications.service';
import {
  NotificationsController,
  NotificationsDigestController,
} from './notifications.controller';
import { AuthModule } from '../auth/auth.module';

@Module({
  imports: [AuthModule],
  providers: [NotificationsService],
  controllers: [NotificationsController, NotificationsDigestController],
  exports: [NotificationsService],
})
export class NotificationsModule {}
