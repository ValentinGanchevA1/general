import { Module, forwardRef } from '@nestjs/common';

import { FriendsModule } from '../friends/friends.module';
import { BlocksController } from './blocks.controller';
import { BlocksService } from './blocks.service';

@Module({
  imports: [forwardRef(() => FriendsModule)],
  controllers: [BlocksController],
  providers: [BlocksService],
  exports: [BlocksService],
})
export class BlocksModule {}
