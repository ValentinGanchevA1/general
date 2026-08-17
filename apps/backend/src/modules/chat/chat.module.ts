import { Module } from '@nestjs/common';
import { ChatService } from './chat.service';
import { ChatController } from './chat.controller';
import { LocationShareService } from './location-share.service';
import { AuthModule } from '../auth/auth.module';
import { PresenceModule } from '../presence/presence.module';

@Module({
  imports: [AuthModule, PresenceModule],
  providers: [ChatService, LocationShareService],
  controllers: [ChatController],
  exports: [ChatService, LocationShareService],
})
export class ChatModule {}
