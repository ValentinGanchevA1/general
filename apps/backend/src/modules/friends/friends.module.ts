import { Module, forwardRef } from '@nestjs/common';

import { BlocksModule } from '../blocks/blocks.module';
import { FriendsController } from './friends.controller';
import { FriendsService } from './friends.service';

@Module({
  imports: [forwardRef(() => BlocksModule)],
  controllers: [FriendsController],
  providers: [FriendsService],
  exports: [FriendsService],
})
export class FriendsModule {}
