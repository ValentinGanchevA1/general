import { Body, Controller, Get, HttpCode, HttpStatus, Post, UseGuards } from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';

import type {
  StartEmailVerificationResponse,
  StartPhoneVerificationResponse,
  UserProfile,
  VerificationLadderStatus,
} from '@g88/shared';

import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { CurrentUser } from '../auth/current-user.decorator';
import { VerificationService } from './verification.service';
import { CheckEmailDto, CheckPhoneDto, StartPhoneDto } from './dto';

@Controller('verification')
@UseGuards(JwtAuthGuard)
export class VerificationController {
  constructor(private readonly verification: VerificationService) {}

  /** GET /api/v1/verification/status — unified ladder (email → phone → id). */
  @Get('status')
  @Throttle({ default: { ttl: 60_000, limit: 30 } })
  status(@CurrentUser('id') userId: string): Promise<VerificationLadderStatus> {
    return this.verification.getLadderStatus(userId);
  }

  /** POST /api/v1/verification/phone/start — send an SMS OTP. */
  @Post('phone/start')
  @HttpCode(HttpStatus.OK)
  @Throttle({ default: { ttl: 60_000, limit: 3 } })
  startPhone(
    @CurrentUser('id') userId: string,
    @Body() dto: StartPhoneDto,
  ): Promise<StartPhoneVerificationResponse> {
    return this.verification.startPhone(userId, dto.phone);
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

  /** POST /api/v1/verification/email/start — send email ownership OTP. */
  @Post('email/start')
  @HttpCode(HttpStatus.OK)
  @Throttle({ default: { ttl: 60_000, limit: 3 } })
  startEmail(@CurrentUser('id') userId: string): Promise<StartEmailVerificationResponse> {
    return this.verification.startEmail(userId);
  }

  /** POST /api/v1/verification/email/check — confirm email OTP; returns updated profile. */
  @Post('email/check')
  @HttpCode(HttpStatus.OK)
  @Throttle({ default: { ttl: 60_000, limit: 6 } })
  checkEmail(
    @CurrentUser('id') userId: string,
    @Body() dto: CheckEmailDto,
  ): Promise<UserProfile> {
    return this.verification.checkEmail(userId, dto.code);
  }
}
