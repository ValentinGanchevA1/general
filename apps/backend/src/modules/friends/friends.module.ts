import { Module, forwardRef } from '@nestjs/common';

import { BlocksModule } from '../blocks/blocks.module';
import { PresenceModule } from '../presence/presence.module';
import { FriendsController } from './friends.controller';
import { FriendsService } from './friends.service';

@Module({
  imports: [forwardRef(() => BlocksModule), PresenceModule],
  controllers: [FriendsController],
  providers: [FriendsService],
  exports: [FriendsService],
})
export class FriendsModule {}
