import { Module } from '@nestjs/common';
import { AchievementsController } from './achievements.controller';
import { AchievementsService } from './achievements.service';
import { GamificationModule } from '../gamification/gamification.module';
import { RealtimeModule } from '../../realtime/realtime.module';

@Module({
  imports: [GamificationModule, RealtimeModule], // awardRaw on unlock + live unlock event
  controllers: [AchievementsController],
  providers: [AchievementsService],
  exports: [AchievementsService], // action-site modules call evaluate()
})
export class AchievementsModule {}
