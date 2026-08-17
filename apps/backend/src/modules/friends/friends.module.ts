import { Module, forwardRef } from '@nestjs/common';

import { BlocksModule } from '../blocks/blocks.module';
import { PresenceModule } from '../presence/presence.module';
import { NotificationsModule } from '../notifications/notifications.module';
import { RealtimeModule } from '../../realtime/realtime.module';
import { FriendsController } from './friends.controller';
import { FriendsService } from './friends.service';
import { FriendsSuggestionsService } from './friends-suggestions.service';
import { FriendsNotifyService } from './friends-notify.service';

@Module({
  imports: [
    forwardRef(() => BlocksModule),
    PresenceModule,
    NotificationsModule,
    forwardRef(() => RealtimeModule),
  ],
  controllers: [FriendsController],
  providers: [FriendsService, FriendsSuggestionsService, FriendsNotifyService],
  exports: [FriendsService, FriendsSuggestionsService],
})
export class FriendsModule {}
