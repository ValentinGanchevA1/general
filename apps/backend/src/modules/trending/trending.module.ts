import { Module } from '@nestjs/common';
import { TrendingController } from './trending.controller';
import { TrendingService } from './trending.service';

@Module({
  controllers: [TrendingController],
  providers: [TrendingService],
})
export class TrendingModule {}
