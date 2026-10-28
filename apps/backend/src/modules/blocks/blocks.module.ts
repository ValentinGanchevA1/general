import { Module, forwardRef } from '@nestjs/common';

import { RealtimeModule } from '../../realtime/realtime.module';
import { FriendsModule } from '../friends/friends.module';
import { BlocksController } from './blocks.controller';
import { BlocksService } from './blocks.service';

@Module({
  imports: [forwardRef(() => FriendsModule), forwardRef(() => RealtimeModule)],
  controllers: [BlocksController],
  providers: [BlocksService],
  exports: [BlocksService],
})
export class BlocksModule {}
