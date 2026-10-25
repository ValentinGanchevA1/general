import { Module } from '@nestjs/common';
import { IdVerificationController } from './id-verification.controller';
import { AdminIdVerificationController } from './admin-id-verification.controller';
import { IdVerificationService } from './id-verification.service';
import { RekognitionService } from './rekognition.service';
import { IdVerificationGateway } from './gateways/id-verification.gateway';
import { S3Service } from '../../common/s3.service';
import { NotificationsModule } from '../notifications/notifications.module';
import { AuthModule } from '../auth/auth.module';

@Module({
  imports: [NotificationsModule, AuthModule],
  controllers: [IdVerificationController, AdminIdVerificationController],
  providers: [
    IdVerificationService,
    RekognitionService,
    S3Service,
    IdVerificationGateway,
  ],
  exports: [IdVerificationService],
})
export class IdVerificationModule {}
