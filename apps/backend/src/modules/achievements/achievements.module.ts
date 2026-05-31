import { Module } from '@nestjs/common';
import { AchievementsController } from './achievements.controller';
import { AchievementsService } from './achievements.service';
import { GamificationModule } from '../gamification/gamification.module';

@Module({
  imports: [GamificationModule], // for awardRaw on unlock
  controllers: [AchievementsController],
  providers: [AchievementsService],
  exports: [AchievementsService], // action-site modules call evaluate()
})
export class AchievementsModule {}
