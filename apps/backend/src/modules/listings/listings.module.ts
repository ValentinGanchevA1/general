import { Module } from '@nestjs/common';
import { ListingsController } from './listings.controller';
import { ListingsExpiryService } from './listings-expiry.service';
import { ListingsService } from './listings.service';
import { NotificationsModule } from '../notifications/notifications.module';
import { RealtimeModule } from '../../realtime/realtime.module';
import { S3Service } from '../../common/s3.service';

@Module({
  imports: [NotificationsModule, RealtimeModule],
  controllers: [ListingsController],
  providers: [ListingsService, ListingsExpiryService, S3Service],
})
export class ListingsModule {}
