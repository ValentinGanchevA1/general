import { Module } from '@nestjs/common';

import { UsersModule } from '../users/users.module';
import { VerificationController } from './verification.controller';
import { VerificationService } from './verification.service';

@Module({
  imports: [UsersModule],
  controllers: [VerificationController],
  providers: [VerificationService],
})
export class VerificationModule {}
