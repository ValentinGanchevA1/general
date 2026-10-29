import {
  Body,
  Controller,
  HttpCode,
  HttpStatus,
  Post,
  UseGuards,
} from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';

import type { DiscoveryResponse, MapDiscoveryResponse } from '@g88/shared';

import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { CurrentUser } from '../auth/current-user.decorator';
import { DiscoveryService } from './discovery.service';
import { PlaceMapDiscoveryService } from './place-map-discovery.service';
import { DiscoveryQueryDto, PlaceDiscoveryQueryDto } from './dto';

@Controller('discovery')
@UseGuards(JwtAuthGuard)
export class DiscoveryController {
  constructor(
    private readonly discovery: DiscoveryService,
    private readonly placeDiscovery: PlaceMapDiscoveryService,
  ) {}

  /**
   * POST /api/v1/discovery/nearby
   *
   * Body holds the viewport (4 corners → too much for a query string).
   * Rate-limited per-user; clients debounce viewport changes on the mobile side
   * but a server cap protects against runaway map panning.
   */
  @Post('nearby')
  @HttpCode(HttpStatus.OK)
  @Throttle({ default: { limit: 30, ttl: 60_000 } }) // 30 req/min/user
  async nearby(
    @Body() dto: DiscoveryQueryDto,
    @CurrentUser('id') userId: string,
  ): Promise<DiscoveryResponse> {
    return this.discovery.nearby({
      viewport: dto.viewport,
      zoom: dto.zoom,
      kinds: dto.kinds,
      requesterId: userId,
      prevViewportHash: dto.prevViewportHash,
      topic: dto.topic,
      listingMode: dto.listingMode,
      marketplaceKind: dto.marketplaceKind,
      friendsOnly: dto.friendsOnly === true,
      datingOnly: dto.datingOnly === true,
      rankBy: dto.rankBy,
    });
  }

  /**
   * Place pins are a separate full-snapshot lane because they are derived from
   * thresholded aggregate trends, not realtime entity presence.
   */
  @Post('places')
  @HttpCode(HttpStatus.OK)
  @Throttle({ default: { limit: 30, ttl: 60_000 } })
  nearbyPlaces(@Body() dto: PlaceDiscoveryQueryDto): Promise<MapDiscoveryResponse> {
    return this.placeDiscovery.nearby(dto.viewport, dto.zoom);
  }
}
