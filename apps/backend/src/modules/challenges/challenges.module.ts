import { Module } from '@nestjs/common';
import { ChallengesController } from './challenges.controller';
import { ChallengesService } from './challenges.service';
import { GamificationModule } from '../gamification/gamification.module';
import { RealtimeModule } from '../../realtime/realtime.module';

@Module({
  imports: [GamificationModule, RealtimeModule],
  controllers: [ChallengesController],
  providers: [ChallengesService],
  exports: [ChallengesService],
})
export class ChallengesModule {}
