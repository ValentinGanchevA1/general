import { Body, Controller, HttpCode, Post, UseGuards } from '@nestjs/common';
import { IsIn, IsObject, IsOptional } from 'class-validator';
import { Throttle } from '@nestjs/throttler';

import {
  PRODUCT_ANALYTICS_EVENTS,
  type ProductAnalyticsEventName,
  type ProductAnalyticsIngestRequest,
  type ProductAnalyticsProperties,
} from '@g88/shared';

import { CurrentUser } from '../auth/current-user.decorator';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { AnalyticsService } from './analytics.service';

const PRODUCT_ANALYTICS_EVENT_VALUES: string[] = [...PRODUCT_ANALYTICS_EVENTS];

class IngestAnalyticsEventDto implements ProductAnalyticsIngestRequest {
  @IsIn(PRODUCT_ANALYTICS_EVENT_VALUES)
  event!: ProductAnalyticsEventName;

  @IsOptional()
  @IsObject()
  properties?: ProductAnalyticsProperties;
}

@Controller('analytics')
@UseGuards(JwtAuthGuard)
export class AnalyticsController {
  constructor(private readonly analytics: AnalyticsService) {}

  @Post('events')
  @HttpCode(204)
  @Throttle({ default: { limit: 120, ttl: 60_000 } })
  async ingest(
    @CurrentUser('id') userId: string,
    @Body() dto: IngestAnalyticsEventDto,
  ): Promise<void> {
    await this.analytics.record(userId, dto.event, dto.properties);
  }
}
