import { Module } from '@nestjs/common';
import { InteractionsService } from './interactions.service';
import { InteractionsController } from './interactions.controller';
import { RealtimeModule } from '../../realtime/realtime.module';
import { NotificationsModule } from '../notifications/notifications.module';
import { GamificationModule } from '../gamification/gamification.module';
import { ChallengesModule } from '../challenges/challenges.module';
import { AchievementsModule } from '../achievements/achievements.module';
import { BlocksModule } from '../blocks/blocks.module';

@Module({
  imports: [
    RealtimeModule,
    NotificationsModule,
    GamificationModule,
    ChallengesModule,
    AchievementsModule,
    BlocksModule,
  ],
  providers: [InteractionsService],
  controllers: [InteractionsController],
})
export class InteractionsModule {}
