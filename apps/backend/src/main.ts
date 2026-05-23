import 'reflect-metadata';
import { config as loadEnv } from 'dotenv';
import { join } from 'path';
loadEnv({ path: join(process.cwd(), '../../.env') });

// Fail fast on missing critical secrets before any module loads.
if (!process.env.JWT_SECRET || process.env.JWT_SECRET.length < 32) {
  throw new Error('JWT_SECRET env var is missing or too short (min 32 chars)');
}
if (!process.env.DATABASE_URL && !process.env.DB_HOST && process.env.NODE_ENV === 'production') {
  throw new Error('DATABASE_URL or DB_HOST must be set in production');
}

import { NestFactory } from '@nestjs/core';
import { Logger, ValidationPipe } from '@nestjs/common';
import type { Request, Response, NextFunction } from 'express';
import helmet from 'helmet';
import { AppModule } from './app.module';
import { AllExceptionsFilter } from './common/all-exceptions.filter';

async function bootstrap(): Promise<void> {
  const logger = new Logger('Bootstrap');
  const app = await NestFactory.create(AppModule);

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
