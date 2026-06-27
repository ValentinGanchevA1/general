import 'reflect-metadata';
import { config as loadEnv } from 'dotenv';
import { join } from 'path';
import * as Sentry from '@sentry/nestjs';
import { NestFactory } from '@nestjs/core';
import { Logger, ValidationPipe, RequestMethod } from '@nestjs/common';
import type { NestExpressApplication } from '@nestjs/platform-express';
import type { Request, Response, NextFunction } from 'express';
import helmet from 'helmet';
import { AppModule } from './app.module';
import { AllExceptionsFilter } from './common/all-exceptions.filter';


loadEnv({ path: join(process.cwd(), '../../.env') });

// ── Sentry PII scrubber (OB1) ───────────────────────────────────────────────
// Hard privacy invariant: coordinates, H3 cells, and tokens must never leave the
// process. Redacts denylisted keys anywhere in the event/breadcrumb and strips
// Bearer tokens from any string value. Fail-safe: over-redaction is acceptable.
const SENTRY_DENY_KEYS = new Set([
  'authorization', 'cookie', 'password', 'passwordhash',
  'token', 'idtoken', 'refreshtoken', 'accesstoken',
  'phone', 'email', 'latitude', 'longitude', 'lat', 'lng',
  'location', 'iddocumenturl',
]);
const SENTRY_BEARER_RE = /Bearer\s+[A-Za-z0-9._-]+/g;

function scrubSentry<T>(value: T, depth = 0): T {
  if (value == null || depth > 8) return value;
  if (typeof value === 'string') {
    return value.replace(SENTRY_BEARER_RE, 'Bearer [redacted]') as unknown as T;
  }
  if (Array.isArray(value)) {
    return value.map((v) => scrubSentry(v, depth + 1)) as unknown as T;
  }
  if (typeof value === 'object') {
    const proto = Object.getPrototypeOf(value);
    if (proto !== Object.prototype && proto !== null) return value;
    const out: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(value as Record<string, unknown>)) {
      out[k] = SENTRY_DENY_KEYS.has(k.toLowerCase())
        ? '[redacted]'
        : scrubSentry(v, depth + 1);
    }
    return out as unknown as T;
  }
  return value;
}

Sentry.init({
  dsn: process.env.SENTRY_DSN,
  environment: process.env.NODE_ENV ?? 'development',
  enabled: !!process.env.SENTRY_DSN,
  sendDefaultPii: false,
  integrations: [Sentry.nestIntegration()],
  // 10 % performance sampling in production; off in dev to keep noise low.
  tracesSampleRate: process.env.NODE_ENV === 'production' ? 0.1 : 0,
  beforeSend: (event) => scrubSentry(event),
  beforeBreadcrumb: (breadcrumb) => scrubSentry(breadcrumb),
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

app.setGlobalPrefix('api/v1', {
  exclude: [{ path: 'health', method: RequestMethod.GET }],
});

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
