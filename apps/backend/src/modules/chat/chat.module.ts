import { Module } from '@nestjs/common';
import { ChatService } from './chat.service';
import { ChatController } from './chat.controller';
import { LocationShareService } from './location-share.service';
import { AuthModule } from '../auth/auth.module';

@Module({
  imports: [AuthModule],
  providers: [ChatService, LocationShareService],
  controllers: [ChatController],
  exports: [ChatService, LocationShareService],
})
export class ChatModule {}
