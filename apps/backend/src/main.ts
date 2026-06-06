import 'reflect-metadata';
import { config as loadEnv } from 'dotenv';
import { join } from 'path';
import * as Sentry from '@sentry/nestjs';
import { NestFactory } from '@nestjs/core';
import { Logger, ValidationPipe } from '@nestjs/common';
import type { NestExpressApplication } from '@nestjs/platform-express';
import type { Request, Response, NextFunction } from 'express';
import helmet from 'helmet';
import { AppModule } from './app.module';
import { AllExceptionsFilter } from './common/all-exceptions.filter';

loadEnv({ path: join(process.cwd(), '../../.env') });

Sentry.init({
  dsn: process.env.SENTRY_DSN,
  environment: process.env.NODE_ENV ?? 'development',
  enabled: !!process.env.SENTRY_DSN,
  sendDefaultPii: false,
  integrations: [Sentry.nestIntegration()],
  // 10 % performance sampling in production; off in dev to keep noise low.
  tracesSampleRate: process.env.NODE_ENV === 'production' ? 0.1 : 0,
});

// Fail fast on missing or weak secrets before any module loads.
if (!process.env.JWT_SECRET || process.env.JWT_SECRET.length < 32) {
  throw new Error('JWT_SECRET env var is missing or too short (min 32 chars)');
}

if (process.env.NODE_ENV === 'production') {
  // Dev placeholder 'dev-jwt-secret-change-in-production' is 36 chars and passes
  // the 32-char check above. Require 64+ chars in production so `openssl rand -hex 64`
  // is the natural path — any shorter value is almost certainly a copied dev default.
  if (process.env.JWT_SECRET.length < 64) {
    throw new Error('JWT_SECRET must be at least 64 chars in production (generate with: openssl rand -hex 64)');
  }
  if (!process.env.DATABASE_URL) {
    throw new Error('DATABASE_URL must be set in production');
  }
}

async function bootstrap(): Promise<void> {
  const logger = new Logger('Bootstrap');
  // rawBody: keeps the unparsed body on req.rawBody for Stripe webhook
  // signature verification (subscriptions/webhook), while JSON parsing still
  // works for every other route.
  const app = await NestFactory.create<NestExpressApplication>(AppModule, { rawBody: true });

  // Raise the JSON limit above the 100 KB default so the mobile base64 photo
  // upload (POST /users/me/photos/base64, ~10 MB image → ~13.5 MB base64) fits.
  app.useBodyParser('json', { limit: '15mb' });

  app.use(helmet());

  app.setGlobalPrefix('api/v1');

  // Development request logger to help debug emulator <-> host networking
  if (process.env.NODE_ENV !== 'production') {
    app.use((req: Request, _res: Response, next: NextFunction) => {
      // Log limited request info to avoid leaking sensitive data
      // Timestamp, method, url, remote ip (from express) and content-length if present
      const time = new Date().toISOString();
      const ip = (req.headers['x-forwarded-for'] as string) || req.socket?.remoteAddress || 'unknown';
      const len = req.headers['content-length'] ?? '-';
      // eslint-disable-next-line no-console
      console.log(`[HTTP] ${time} ${req.method} ${req.originalUrl} from ${ip} len=${len}`);
      next();
    });
  }

  app.useGlobalFilters(new AllExceptionsFilter());

  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      transform: true,
      forbidNonWhitelisted: true,
    }),
  );

  app.enableCors({
    origin: (process.env.CORS_ORIGINS ?? 'http://localhost:3000').split(',').filter(Boolean),
    credentials: true,
  });

  const port = Number(process.env.PORT ?? 3001);
  await app.listen(port);
  logger.log(`Backend running on http://localhost:${port}/api/v1`);
}

void bootstrap();
