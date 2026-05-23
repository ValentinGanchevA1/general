// apps/backend/src/modules/feed/feed.module.ts
import { Module } from '@nestjs/common';

import { AuthModule } from '../auth/auth.module';
import { FeedController } from './feed.controller';
import { FeedService } from './feed.service';

@Module({
  imports: [AuthModule],
  controllers: [FeedController],
  providers: [FeedService],
})
export class FeedModule {}
