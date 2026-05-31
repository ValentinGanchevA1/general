import { Controller, Get, UseGuards } from '@nestjs/common';
import { SkipThrottle } from '@nestjs/throttler';

import type { AchievementStatus } from '@g88/shared';

import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { CurrentUser } from '../auth/current-user.decorator';
import { AchievementsService } from './achievements.service';

@Controller('achievements')
@UseGuards(JwtAuthGuard)
export class AchievementsController {
  constructor(private readonly achievements: AchievementsService) {}

  /** Full catalog merged with this user's unlock + progress state. */
  @Get()
  @SkipThrottle()
  list(@CurrentUser('id') userId: string): Promise<AchievementStatus[]> {
    return this.achievements.list(userId);
  }
}
