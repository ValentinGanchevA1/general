import { Module } from '@nestjs/common';
import { ChatService } from './chat.service';
import { ChatRealtimeAccessService } from './chat-realtime-access.service';
import { ChatController } from './chat.controller';
import { GroupConversationsController } from './group-conversations.controller';
import { GroupConversationsService } from './group-conversations.service';
import { LocationShareService } from './location-share.service';
import { AuthModule } from '../auth/auth.module';
import { PresenceModule } from '../presence/presence.module';
import { AnalyticsModule } from '../analytics/analytics.module';

@Module({
  imports: [AuthModule, PresenceModule, AnalyticsModule],
  providers: [
    ChatService,
    ChatRealtimeAccessService,
    GroupConversationsService,
    LocationShareService,
  ],
  controllers: [ChatController, GroupConversationsController],
  exports: [
    ChatService,
    ChatRealtimeAccessService,
    GroupConversationsService,
    LocationShareService,
  ],
})
export class ChatModule {}
