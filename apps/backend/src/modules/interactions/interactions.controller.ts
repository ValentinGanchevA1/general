import { Body, Controller, Post, UseGuards } from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';

import type { WaveRequest, WaveResponse } from '@g88/shared';

import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { CurrentUser } from '../auth/current-user.decorator';
import { InteractionsService } from './interactions.service';

export class WaveDto implements WaveRequest {
  toUserId!: string;
  context?: 'map' | 'profile' | 'event';
}

@Controller('interactions')
@UseGuards(JwtAuthGuard)
export class InteractionsController {
  constructor(private readonly interactions: InteractionsService) {}

  @Post('wave')
  @Throttle({ default: { limit: 20, ttl: 60_000 } }) // 20 waves/min
  async wave(
    @Body() dto: WaveDto,
    @CurrentUser('id') userId: string,
  ): Promise<WaveResponse> {
    return this.interactions.wave(userId, dto);
  }
}
