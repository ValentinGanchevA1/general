import { Body, Controller, HttpCode, HttpStatus, Post, UseGuards } from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';

import type { MarketplaceListingSummary } from '@g88/shared';

import { DiscoveryRealtimePublisher } from '../../realtime/discovery-realtime.publisher';
import { CurrentUser } from '../auth/current-user.decorator';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { BrowseMarketplaceDto, CreateMarketplaceListingDto } from './marketplace.dto';
import { MarketplaceService } from './marketplace.service';

@Controller('marketplace')
@UseGuards(JwtAuthGuard)
export class MarketplaceController {
  constructor(
    private readonly marketplace: MarketplaceService,
    private readonly discovery: DiscoveryRealtimePublisher,
  ) {}

  @Post()
  @HttpCode(HttpStatus.CREATED)
  @Throttle({ default: { ttl: 60_000, limit: 15 } })
  async create(
    @CurrentUser('id') userId: string,
    @Body() dto: CreateMarketplaceListingDto,
  ): Promise<MarketplaceListingSummary> {
    const listing = await this.marketplace.create(userId, dto);
    if ((dto.visibility ?? 'public') === 'public') {
      void this.discovery.publishEntityChangeToSubscribers({
        kind: 'listing',
        entityId: listing.id,
        location: dto.location,
        change: 'enter',
      }).catch(() => undefined);
    }
    return listing;
  }

  @Post('browse')
  @HttpCode(HttpStatus.OK)
  @Throttle({ default: { ttl: 60_000, limit: 90 } })
  browse(
    @CurrentUser('id') userId: string,
    @Body() dto: BrowseMarketplaceDto,
  ): Promise<MarketplaceListingSummary[]> {
    return this.marketplace.browse(userId, dto);
  }
}
