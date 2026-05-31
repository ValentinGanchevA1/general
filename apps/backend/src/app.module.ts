import { Module } from '@nestjs/common';
import { APP_GUARD } from '@nestjs/core';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ThrottlerGuard, ThrottlerModule } from '@nestjs/throttler';

import { RedisModule } from './config/redis.module';
import { AuthModule } from './modules/auth/auth.module';
import { UsersModule } from './modules/users/users.module';
import { DiscoveryModule } from './modules/discovery/discovery.module';
import { InteractionsModule } from './modules/interactions/interactions.module';
import { PresenceModule } from './modules/presence/presence.module';
import { ChatModule } from './modules/chat/chat.module';
import { NotificationsModule } from './modules/notifications/notifications.module';
import { AlertsModule } from './modules/alerts/alerts.module';
import { GeofencesModule } from './modules/geofences/geofences.module';
import { FeedModule } from './modules/feed/feed.module';
import { TrendingModule } from './modules/trending/trending.module';
import { GamificationModule } from './modules/gamification/gamification.module';
import { ChallengesModule } from './modules/challenges/challenges.module';
import { AchievementsModule } from './modules/achievements/achievements.module';
import { VerificationModule } from './modules/verification/verification.module';
import { SubscriptionsModule } from './modules/subscriptions/subscriptions.module';
import { RealtimeModule } from './realtime/realtime.module';

@Module({
  imports: [
    TypeOrmModule.forRootAsync({
      useFactory: () => {
        const url = process.env.DATABASE_URL;
        if (url) {
          return { type: 'postgres' as const, url, synchronize: false, entities: [] };
        }
        if (process.env.NODE_ENV === 'production') {
          throw new Error('DATABASE_URL must be set in production');
        }
        return {
          type: 'postgres' as const,
          host: process.env.DB_HOST ?? 'localhost',
          port: Number(process.env.DB_PORT ?? 5432),
          username: process.env.DB_USER ?? 'g88',
          password: process.env.DB_PASSWORD ?? 'g88dev',
          database: process.env.DB_NAME ?? 'g88',
          synchronize: false,
          entities: [],
        };
      },
    }),
    ThrottlerModule.forRoot([{ ttl: 60_000, limit: 120 }]),
    RedisModule,
    AuthModule,
    UsersModule,
    DiscoveryModule,
    InteractionsModule,
    PresenceModule,
    ChatModule,
    NotificationsModule,
    AlertsModule,
    GeofencesModule,
    FeedModule,
    TrendingModule,
    GamificationModule,
    ChallengesModule,
    AchievementsModule,
    VerificationModule,
    SubscriptionsModule,
    RealtimeModule,
  ],
  providers: [{ provide: APP_GUARD, useClass: ThrottlerGuard }],
})
export class AppModule {}
