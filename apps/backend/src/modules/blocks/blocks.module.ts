import { Module, forwardRef } from '@nestjs/common';

import { RealtimeModule } from '../../realtime/realtime.module';
import { ChatModule } from '../chat/chat.module';
import { FriendsModule } from '../friends/friends.module';
import { BlocksController } from './blocks.controller';
import { BlocksService } from './blocks.service';

@Module({
  imports: [
    ChatModule,
    forwardRef(() => FriendsModule),
    forwardRef(() => RealtimeModule),
  ],
  controllers: [BlocksController],
  providers: [BlocksService],
  exports: [BlocksService],
})
export class BlocksModule {}
