import { Body, Controller, Post, UseGuards } from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import { IsUUID } from 'class-validator';
import type { LikeRequest, LikeResponse } from '@g88/shared';

import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { CurrentUser } from '../auth/current-user.decorator';
import { DatingService } from './dating.service';

export class LikeDto implements LikeRequest {
  @IsUUID()
  toUserId!: string;
}

export class PassDto {
  @IsUUID()
  toUserId!: string;
}

@Controller('dating')
@UseGuards(JwtAuthGuard)
export class DatingController {
  constructor(private readonly dating: DatingService) {}

  @Post('likes')
  @Throttle({ default: { limit: 30, ttl: 60_000 } })
  async like(
    @Body() dto: LikeDto,
    @CurrentUser('id') userId: string,
  ): Promise<LikeResponse> {
    return this.dating.like(userId, dto);
  }

  @Post('pass')
  @Throttle({ default: { limit: 40, ttl: 60_000 } })
  async pass(
    @Body() dto: PassDto,
    @CurrentUser('id') userId: string,
  ): Promise<{ ok: true }> {
    return this.dating.pass(userId, dto.toUserId);
  }
}
