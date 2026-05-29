import {
  Body, Controller, Get, HttpCode, HttpStatus, Post, UseGuards,
} from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';

import type { GeofenceResponse } from '@g88/shared';

import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { CurrentUser } from '../auth/current-user.decorator';
import { GeofencesService } from './geofences.service';
import { CreateGeofenceDto } from './dto';

@Controller('geofences')
@UseGuards(JwtAuthGuard)
export class GeofencesController {
  constructor(private readonly geofences: GeofencesService) {}

  /**
   * POST /api/v1/geofences
   *
   * Creates or updates a geofence anchored at the caller's current location.
   * Upserts on (user_id, center_h3_r7) so re-POSTing from the same area
   * updates label/radius instead of creating a duplicate.
   */
  @Post()
  @HttpCode(HttpStatus.CREATED)
  @Throttle({ default: { ttl: 60_000, limit: 20 } })
  upsert(
    @CurrentUser() userId: string,
    @Body() dto: CreateGeofenceDto,
  ): Promise<GeofenceResponse> {
    return this.geofences.upsert(userId, dto);
  }

  /**
   * GET /api/v1/geofences/me/active
   *
   * Returns the caller's active geofences, each annotated with an `inside`
   * boolean indicating whether their current location falls within the disk.
   * Used by the ContextualFab (v1.5) to refine context decisions.
   */
  @Get('me/active')
  @Throttle({ default: { ttl: 60_000, limit: 60 } })
  getActive(@CurrentUser() userId: string): Promise<GeofenceResponse[]> {
    return this.geofences.getActive(userId);
  }
}
