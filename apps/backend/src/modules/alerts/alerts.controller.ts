import {
  Body, Controller, HttpCode, HttpStatus, Post, UseGuards,
} from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';

import type { AlertResponse } from '@g88/shared';

import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { CurrentUser } from '../auth/current-user.decorator';
import { AlertsService } from './alerts.service';
import { CreateAlertDto } from './dto';

@Controller('alerts')
@UseGuards(JwtAuthGuard)
export class AlertsController {
  constructor(private readonly alerts: AlertsService) {}

  /**
   * POST /api/v1/alerts
   *
   * Persists a location-tagged area alert authored by the calling user.
   * Location is copied from the user's last fuzzed heartbeat position.
   */
  @Post()
  @HttpCode(HttpStatus.CREATED)
  @Throttle({ default: { ttl: 60_000, limit: 10 } })
  create(
    @CurrentUser() userId: string,
    @Body() dto: CreateAlertDto,
  ): Promise<AlertResponse> {
    return this.alerts.create(userId, dto);
  }
}
