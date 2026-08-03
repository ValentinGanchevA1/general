import { Module } from '@nestjs/common';

import { S3Service } from '../../common/s3.service';
import { RealtimeModule } from '../../realtime/realtime.module';
import { StoriesController } from './stories.controller';
import { StoriesService } from './stories.service';
import { StoriesCleanupService } from './stories-cleanup.service';

@Module({
  imports: [RealtimeModule],
  controllers: [StoriesController],
  providers: [StoriesService, StoriesCleanupService, S3Service],
  exports: [StoriesService],
})
export class StoriesModule {}
