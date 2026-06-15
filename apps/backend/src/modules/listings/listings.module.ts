import { Module } from '@nestjs/common';
import { ListingsController } from './listings.controller';
import { ListingsService } from './listings.service';
import { NotificationsModule } from '../notifications/notifications.module';
import { S3Service } from '../../common/s3.service';

@Module({
  imports: [NotificationsModule],
  controllers: [ListingsController],
  providers: [ListingsService, S3Service],
})
export class ListingsModule {}
