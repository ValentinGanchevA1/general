import 'reflect-metadata';
import { config as loadEnv } from 'dotenv';
import { join } from 'path';
import * as Sentry from '@sentry/nestjs';
import { NestFactory } from '@nestjs/core';
import { Logger, ValidationPipe, RequestMethod } from '@nestjs/common';
import type { NestExpressApplication } from '@nestjs/platform-express';
import type { Request, Response, NextFunction } from 'express';
import helmet from 'helmet';
import { scrubSentryPayload } from '@g88/shared';
import { AppModule } from './app.module';
import { AllExceptionsFilter } from './common/all-exceptions.filter';


loadEnv({ path: join(process.cwd(), '../../.env') });

Sentry.init({
  dsn: process.env.SENTRY_DSN,
  environment: process.env.NODE_ENV ?? 'development',
  enabled: !!process.env.SENTRY_DSN,
  sendDefaultPii: false,
  integrations: [Sentry.nestIntegration()],
  tracesSampleRate: process.env.NODE_ENV === 'production' ? 0.1 : 0,
  beforeSend: (event) => scrubSentryPayload(event),
  beforeBreadcrumb: (breadcrumb) => scrubSentryPayload(breadcrumb),
});

if (!process.env.JWT_SECRET || process.env.JWT_SECRET.length < 32) {
  throw new Error('JWT_SECRET env var is missing or too short (min 32 chars)');
}

if (process.env.NODE_ENV === 'production') {
  if (process.env.JWT_SECRET.length < 64) {
    throw new Error('JWT_SECRET must be at least 64 chars in production (generate with: openssl rand -hex 64)');
  }
  if (!process.env.DATABASE_URL) {
    throw new Error('DATABASE_URL must be set in production');
  }
}

async function bootstrap(): Promise<void> {
  const logger = new Logger('Bootstrap');
  const app = await NestFactory.create<NestExpressApplication>(AppModule, { rawBody: true });

  // Story video base64 (15s) + photos
  app.useBodyParser('json', { limit: '25mb' });

  app.use(helmet());

  app.setGlobalPrefix('api/v1', {
    exclude: [{ path: 'health', method: RequestMethod.GET }],
  });

  if (process.env.NODE_ENV !== 'production') {
    app.use((req: Request, _res: Response, next: NextFunction) => {
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
