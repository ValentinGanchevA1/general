import { Controller, Get, HttpCode, HttpStatus, Post, UseGuards } from '@nestjs/common';
import { SkipThrottle, Throttle } from '@nestjs/throttler';

import type { GamificationSummary } from '@g88/shared';

import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { CurrentUser } from '../auth/current-user.decorator';
import { GamificationService } from './gamification.service';

@Controller('gamification')
@UseGuards(JwtAuthGuard)
export class GamificationController {
  constructor(private readonly gamification: GamificationService) {}

  /** Current XP / level / streak for the signed-in user. */
  @Get('me')
  @SkipThrottle()
  me(@CurrentUser('id') userId: string): Promise<GamificationSummary> {
    return this.gamification.getSummary(userId);
  }

  /** Advance the daily streak. Called on app foreground. Returns fresh summary. */
  @Post('ping')
  @HttpCode(HttpStatus.OK)
  @Throttle({ default: { ttl: 60_000, limit: 30 } })
  ping(@CurrentUser('id') userId: string): Promise<GamificationSummary> {
    return this.gamification.ping(userId);
  }
}
