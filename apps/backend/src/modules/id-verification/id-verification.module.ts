import { Module } from '@nestjs/common';
import { IdVerificationController } from './id-verification.controller';
import { AdminIdVerificationController } from './admin-id-verification.controller';
import { IdVerificationService } from './id-verification.service';
import { S3Service } from '../../common/s3.service';
import { NotificationsModule } from '../notifications/notifications.module';

@Module({
  imports: [NotificationsModule],
  controllers: [IdVerificationController, AdminIdVerificationController],
  providers: [IdVerificationService, S3Service],
  exports: [IdVerificationService],
})
export class IdVerificationModule {}
