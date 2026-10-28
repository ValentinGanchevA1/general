// apps/backend/src/modules/feed/feed.controller.ts
import { Body, Controller, Get, Post, Query, UseGuards } from '@nestjs/common';

import type { ActivityType, FeedResponse, PulseCheckInResult } from '@g88/shared';

import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { CurrentUser } from '../auth/current-user.decorator';
import { PlaceActivityLinkService } from './place-activity-link.service';
import { PulseCheckInService } from './pulse-check-in.service';
import {
  CreatePlacePulseCheckInDto,
  CreatePulseCheckInDto,
} from './pulse-check-in.dto';
import { PulseDiscoveryFeedService } from './pulse-discovery-feed.service';

@Controller('feed')
@UseGuards(JwtAuthGuard)
export class FeedController {
  constructor(
    private readonly feed: PulseDiscoveryFeedService,
    private readonly checkIns: PulseCheckInService,
    private readonly placeLinks: PlaceActivityLinkService,
  ) {}

  @Get()
  async list(
    @CurrentUser('id') userId: string,
    @Query('since') since?: string,
    @Query('types') types?: string,
    @Query('limit') limit?: string,
  ): Promise<FeedResponse> {
    // Pulse is a local-discovery surface. Personal activity belongs in Interactions.
    const sinceDate = since ? new Date(since) : new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
    const requested = (types ? types.split(',').filter(Boolean) : []) as ActivityType[];
    const pulseTypes: ActivityType[] = ['alert', 'listing', 'event', 'place'];
    const typeList = requested.length > 0
      ? requested.filter((type) => pulseTypes.includes(type))
      : pulseTypes;
    const cap = Math.min(Number(limit ?? 50) || 50, 100);

    if (requested.length > 0 && typeList.length === 0) {
      return { items: [], nextSince: new Date().toISOString() };
    }

    const response = await this.feed.aggregate(userId, sinceDate, typeList, cap);
    return this.placeLinks.enrich(response);
  }

  @Post('check-ins')
  createCheckIn(
    @CurrentUser('id') userId: string,
    @Body() dto: CreatePulseCheckInDto,
  ): Promise<PulseCheckInResult> {
    return this.checkIns.create(userId, dto);
  }

  @Post('check-ins/by-place')
  createPlaceCheckIn(
    @CurrentUser('id') userId: string,
    @Body() dto: CreatePlacePulseCheckInDto,
  ): Promise<PulseCheckInResult> {
    return this.checkIns.createForPlace(userId, dto);
  }
}
