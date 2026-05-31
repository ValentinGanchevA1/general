import { Body, Controller, HttpCode, HttpStatus, Post, UseGuards } from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';

import type { StartPhoneVerificationResponse, UserProfile } from '@g88/shared';

import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { CurrentUser } from '../auth/current-user.decorator';
import { VerificationService } from './verification.service';
import { CheckPhoneDto, StartPhoneDto } from './dto';

@Controller('verification')
@UseGuards(JwtAuthGuard)
export class VerificationController {
  constructor(private readonly verification: VerificationService) {}

  /** POST /api/v1/verification/phone/start — send an SMS OTP. */
  @Post('phone/start')
  @HttpCode(HttpStatus.OK)
  @Throttle({ default: { ttl: 60_000, limit: 3 } })
  startPhone(@Body() dto: StartPhoneDto): Promise<StartPhoneVerificationResponse> {
    return this.verification.startPhone(dto.phone);
  }

  /** POST /api/v1/verification/phone/check — confirm the OTP; returns the updated profile. */
  @Post('phone/check')
  @HttpCode(HttpStatus.OK)
  @Throttle({ default: { ttl: 60_000, limit: 6 } })
  checkPhone(
    @CurrentUser('id') userId: string,
    @Body() dto: CheckPhoneDto,
  ): Promise<UserProfile> {
    return this.verification.checkPhone(userId, dto.phone, dto.code);
  }
}
