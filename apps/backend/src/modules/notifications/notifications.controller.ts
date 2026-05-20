import { Body, Controller, HttpCode, Post, UseGuards } from '@nestjs/common';
import { IsIn, IsString } from 'class-validator';
import { Throttle } from '@nestjs/throttler';

import type { RegisterDeviceTokenRequest } from '@g88/shared';

import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { CurrentUser } from '../auth/current-user.decorator';
import { NotificationsService } from './notifications.service';

class RegisterTokenDto implements RegisterDeviceTokenRequest {
  @IsString() token!: string;
  @IsIn(['ios', 'android']) platform!: 'ios' | 'android';
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
}
