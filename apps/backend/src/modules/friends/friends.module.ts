import { Module, forwardRef } from '@nestjs/common';

import { BlocksModule } from '../blocks/blocks.module';
import { PresenceModule } from '../presence/presence.module';
import { FriendsController } from './friends.controller';
import { FriendsService } from './friends.service';
import { FriendsSuggestionsService } from './friends-suggestions.service';

@Module({
  imports: [forwardRef(() => BlocksModule), PresenceModule],
  controllers: [FriendsController],
  providers: [FriendsService, FriendsSuggestionsService],
  exports: [FriendsService, FriendsSuggestionsService],
})
export class FriendsModule {}
