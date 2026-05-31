import { Controller, Get, UseGuards } from '@nestjs/common';
import { SkipThrottle } from '@nestjs/throttler';

import type { ChallengeToday } from '@g88/shared';

import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { CurrentUser } from '../auth/current-user.decorator';
import { ChallengesService } from './challenges.service';

@Controller('challenges')
@UseGuards(JwtAuthGuard)
export class ChallengesController {
  constructor(private readonly challenges: ChallengesService) {}

  /** Today's 3 challenges with the caller's progress. */
  @Get('today')
  @SkipThrottle()
  today(@CurrentUser('id') userId: string): Promise<ChallengeToday[]> {
    return this.challenges.getToday(userId);
  }
}
