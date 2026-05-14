import {
  Body,
  Controller,
  HttpCode,
  HttpStatus,
  Post,
  UseGuards,
} from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';

import type { DiscoveryResponse } from '@g88/shared';

import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { CurrentUser } from '../auth/current-user.decorator';
import { DiscoveryService } from './discovery.service';
import { DiscoveryQueryDto } from './dto';

@Controller('discovery')
@UseGuards(JwtAuthGuard)
export class DiscoveryController {
  constructor(private readonly discovery: DiscoveryService) {}

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
    });
  }
}
