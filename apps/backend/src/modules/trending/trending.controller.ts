import { Controller, Get, Query, UseGuards } from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';

import type { TrendingResponse } from '@g88/shared';

import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { TrendingService } from './trending.service';
import { TrendingNearbyQuery } from './dto';

@Controller('trending')
@UseGuards(JwtAuthGuard)
export class TrendingController {
  constructor(private readonly trending: TrendingService) {}

  /**
   * GET /api/v1/trending/nearby?lat=&lng=
   *
   * Returns up to 10 hashtag-format trending topics derived from nearby
   * events and listings. Results are cached per H3 r7 cell for 5 minutes.
   */
  @Get('nearby')
  @Throttle({ default: { ttl: 60_000, limit: 30 } })
  nearby(@Query() q: TrendingNearbyQuery): Promise<TrendingResponse> {
    return this.trending.nearbyTopics(q.lat, q.lng);
  }
}
