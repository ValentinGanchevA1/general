import { Module } from '@nestjs/common';

import { AuthModule } from '../auth/auth.module';
import { MessagingService } from './messaging.service';
import { MessagingController } from './messaging.controller';

@Module({
  imports: [AuthModule],
  providers: [MessagingService],
  controllers: [MessagingController],
  exports: [MessagingService],
})
export class MessagingModule {}
