import { Module } from '@nestjs/common';
import { IdVerificationController } from './id-verification.controller';
import { IdVerificationService } from './id-verification.service';
import { S3Service } from '@/common/s3.service';

@Module({
  controllers: [IdVerificationController],
  providers: [IdVerificationService, S3Service],
  exports: [IdVerificationService],
})
export class IdVerificationModule {}
