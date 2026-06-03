import { Module } from '@nestjs/common';

import { GamificationModule } from '../gamification/gamification.module';
import { RealtimeModule } from '../../realtime/realtime.module';
import { GiftsController } from './gifts.controller';
import { GiftsService } from './gifts.service';

@Module({
  imports: [GamificationModule, RealtimeModule],
  controllers: [GiftsController],
  providers: [GiftsService],
  exports: [GiftsService],
})
export class GiftsModule {}
