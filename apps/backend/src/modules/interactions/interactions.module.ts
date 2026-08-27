import { Module } from '@nestjs/common';
import { InteractionsService } from './interactions.service';
import { InteractionsController } from './interactions.controller';
import { RealtimeModule } from '../../realtime/realtime.module';
import { NotificationsModule } from '../notifications/notifications.module';
import { GamificationModule } from '../gamification/gamification.module';
import { ChallengesModule } from '../challenges/challenges.module';
import { AchievementsModule } from '../achievements/achievements.module';
import { BlocksModule } from '../blocks/blocks.module';
import { FriendsModule } from '../friends/friends.module';

@Module({
  imports: [
    RealtimeModule,
    NotificationsModule,
    GamificationModule,
    ChallengesModule,
    AchievementsModule,
    BlocksModule,
    FriendsModule,
  ],
  providers: [InteractionsService],
  controllers: [InteractionsController],
})
export class InteractionsModule {}
