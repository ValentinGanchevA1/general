import { Module } from '@nestjs/common';
import { InteractionsService } from './interactions.service';
import { InteractionsInboxService } from './interactions-inbox.service';
import { InteractionsController } from './interactions.controller';
import { WaveIdempotencyService } from './wave-idempotency.service';
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
  providers: [InteractionsService, InteractionsInboxService, WaveIdempotencyService],
  controllers: [InteractionsController],
})
export class InteractionsModule {}
