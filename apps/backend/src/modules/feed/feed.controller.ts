// apps/backend/src/modules/feed/feed.controller.ts
import { Controller, Get, Query, UseGuards } from '@nestjs/common';

import type { FeedResponse, ActivityType } from '@g88/shared';

import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { CurrentUser } from '../auth/current-user.decorator';
import { FeedService } from './feed.service';

@Controller('feed')
@UseGuards(JwtAuthGuard)
export class FeedController {
  constructor(private readonly feed: FeedService) {}

  @Get()
  async list(
    @CurrentUser('id') userId: string,
    @Query('since') since?: string,
    @Query('types') types?: string,
    @Query('limit') limit?: string,
  ): Promise<FeedResponse> {
    const sinceDate = since ? new Date(since) : new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
    const typeList = (types ? types.split(',').filter(Boolean) : []) as ActivityType[];
    const cap = Math.min(Number(limit ?? 50) || 50, 100);
    return this.feed.aggregate(userId, sinceDate, typeList, cap);
  }
}
