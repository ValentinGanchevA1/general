import {
  Body,
  Controller,
  ForbiddenException,
  Get,
  Headers,
  HttpCode,
  Patch,
  Post,
  UseGuards,
} from '@nestjs/common';
import { IsIn, IsObject, IsString } from 'class-validator';
import { SkipThrottle, Throttle } from '@nestjs/throttler';

import type {
  NotificationPreferences,
  RegisterDeviceTokenRequest,
  UpdateNotificationPreferencesRequest,
} from '@g88/shared';

import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { CurrentUser } from '../auth/current-user.decorator';
import { NotificationsService } from './notifications.service';

class RegisterTokenDto implements RegisterDeviceTokenRequest {
  @IsString() token!: string;
  @IsIn(['ios', 'android']) platform!: 'ios' | 'android';
}

class UpdatePreferencesDto implements UpdateNotificationPreferencesRequest {
  // Dynamic channel→boolean map; channels + boolean values are validated in the
  // service (setPreferences ignores unknown channels / non-boolean values).
  @IsObject()
  preferences!: Partial<NotificationPreferences>;
}

@Controller('notifications')
@UseGuards(JwtAuthGuard)
export class NotificationsController {
  constructor(private readonly notifications: NotificationsService) {}

  @Post('device-token')
  @HttpCode(204)
  @Throttle({ default: { limit: 10, ttl: 60_000 } })
  async registerToken(
    @Body() dto: RegisterTokenDto,
    @CurrentUser('id') userId: string,
  ): Promise<void> {
    await this.notifications.registerToken(userId, dto.token, dto.platform);
  }

  /** GET /api/v1/notifications/preferences — all channels with on/off state. */
  @Get('preferences')
  getPreferences(@CurrentUser('id') userId: string): Promise<NotificationPreferences> {
    return this.notifications.getPreferences(userId);
  }

  /** PATCH /api/v1/notifications/preferences — set per-channel opt-out. */
  @Patch('preferences')
  updatePreferences(
    @CurrentUser('id') userId: string,
    @Body() dto: UpdatePreferencesDto,
  ): Promise<NotificationPreferences> {
    return this.notifications.setPreferences(userId, dto.preferences);
  }
}

/**
 * Digest trigger — called by a scheduled GitHub Actions workflow, not a user, so
 * it sits outside the JWT-guarded controller and authenticates with a shared
 * secret header instead. Disabled (403) until NOTIFICATIONS_DIGEST_SECRET is set.
 */
@Controller('notifications/digest')
export class NotificationsDigestController {
  constructor(private readonly notifications: NotificationsService) {}

  @Post('run')
  @SkipThrottle()
  run(@Headers('x-digest-secret') secret?: string): Promise<{ candidates: number; sent: number }> {
    const expected = process.env.NOTIFICATIONS_DIGEST_SECRET;
    if (!expected || secret !== expected) {
      throw new ForbiddenException({ code: 'digest.forbidden', message: 'Invalid digest secret.' });
    }
    return this.notifications.runDigest();
  }
}
