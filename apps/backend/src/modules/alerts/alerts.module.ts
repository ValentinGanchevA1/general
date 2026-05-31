import { Module } from '@nestjs/common';
import { AlertsController } from './alerts.controller';
import { AlertsService } from './alerts.service';
import { NotificationsModule } from '../notifications/notifications.module';
import { GamificationModule } from '../gamification/gamification.module';
import { ChallengesModule } from '../challenges/challenges.module';

@Module({
  imports: [NotificationsModule, GamificationModule, ChallengesModule],
  controllers: [AlertsController],
  providers: [AlertsService],
})
export class AlertsModule {}
