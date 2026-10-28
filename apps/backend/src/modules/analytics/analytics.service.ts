import { createHmac } from 'node:crypto';
import {
  BadRequestException,
  Injectable,
  Logger,
  OnModuleDestroy,
  OnModuleInit,
  ServiceUnavailableException,
} from '@nestjs/common';
import { InjectDataSource } from '@nestjs/typeorm';
import { DataSource } from 'typeorm';

import {
  PRODUCT_ANALYTICS_CONNECTION_MECHANISMS,
  PRODUCT_ANALYTICS_ENTITY_TYPES,
  PRODUCT_ANALYTICS_EVENTS,
  PRODUCT_ANALYTICS_SURFACES,
  RSVP_STATUSES,
  type ProductAnalyticsEventName,
  type ProductAnalyticsProperties,
} from '@g88/shared';

import { PostHogAnalyticsSink } from './posthog-analytics.sink';
import { PostHogPrivacyService } from './posthog-privacy.service';

const EVENT_SET = new Set<string>(PRODUCT_ANALYTICS_EVENTS);
const ENTITY_TYPE_SET = new Set<string>(PRODUCT_ANALYTICS_ENTITY_TYPES);
const SURFACE_SET = new Set<string>(PRODUCT_ANALYTICS_SURFACES);
const CONNECTION_SET = new Set<string>(PRODUCT_ANALYTICS_CONNECTION_MECHANISMS);
const RSVP_SET = new Set<string>(RSVP_STATUSES);
const SESSION_PATH_SET = new Set<string>(['map', 'non_map']);

const DEFAULT_RETENTION_DAYS = 90;
const MIN_RETENTION_DAYS = 30;
const MAX_RETENTION_DAYS = 365;
const PRUNE_INTERVAL_MS = 6 * 60 * 60 * 1_000;
const INITIAL_PRUNE_DELAY_MS = 15 * 60 * 1_000;
const PRUNE_RETRY_DELAY_MS = 60 * 60 * 1_000;
const DAY_MS = 24 * 60 * 60 * 1_000;

function pickString(
  props: ProductAnalyticsProperties,
  key: string,
  allowed: ReadonlySet<string>,
): string | undefined {
  const value = props[key];
  return typeof value === 'string' && allowed.has(value) ? value : undefined;
}

function pickBoolean(props: ProductAnalyticsProperties, key: string): boolean | undefined {
  const value = props[key];
  return typeof value === 'boolean' ? value : undefined;
}

function resolveRetentionDays(raw: string | undefined): number {
  const parsed = Number.parseInt(raw ?? '', 10);
  if (!Number.isFinite(parsed)) return DEFAULT_RETENTION_DAYS;
  return Math.min(MAX_RETENTION_DAYS, Math.max(MIN_RETENTION_DAYS, parsed));
}

/**
 * Second privacy boundary after the mobile allow-list. Unknown keys and invalid
 * values are dropped rather than persisted, so arbitrary caller payloads cannot
 * turn analytics_events into a shadow logging/PII table.
 */
export function sanitizeProductAnalyticsProperties(
  event: ProductAnalyticsEventName,
  input: ProductAnalyticsProperties | undefined,
): ProductAnalyticsProperties {
  const props = input ?? {};
  const out: ProductAnalyticsProperties = {};

  switch (event) {
    case 'app.session_started': {
      const path = pickString(props, 'path', SESSION_PATH_SET);
      if (path) out.path = path;
      return out;
    }
    case 'entity.opened': {
      const entityType = pickString(props, 'entityType', ENTITY_TYPE_SET);
      const surface = pickString(props, 'surface', SURFACE_SET);
      if (entityType) out.entityType = entityType;
      if (surface) out.surface = surface;
      return out;
    }
    case 'interaction.wave_sent': {
      const mutual = pickBoolean(props, 'mutual');
      const surface = pickString(props, 'surface', SURFACE_SET);
      if (mutual !== undefined) out.mutual = mutual;
      if (surface) out.surface = surface;
      return out;
    }
    case 'event.rsvp_confirmed': {
      const status = pickString(props, 'status', RSVP_SET);
      if (status) out.status = status;
      return out;
    }
    case 'marketplace.offer_sent':
    case 'chat.message_sent':
      return out;
    case 'connection.created': {
      const mechanism = pickString(props, 'mechanism', CONNECTION_SET);
      if (mechanism) out.mechanism = mechanism;
      return out;
    }
  }
}

export async function pruneExpiredAnalytics(
  db: DataSource,
  retentionDays: number,
): Promise<void> {
  await db.query(
    `DELETE FROM analytics_events
      WHERE received_at < NOW() - ($1::int * INTERVAL '1 day')`,
    [retentionDays],
  );

  await db.query(
    `DELETE FROM analytics_subjects s
      WHERE s.updated_at < NOW() - ($1::int * INTERVAL '1 day')
        AND NOT EXISTS (
          SELECT 1
            FROM analytics_events e
           WHERE e.subject_hash = s.subject_hash
        )`,
    [retentionDays],
  );
}

@Injectable()
export class AnalyticsService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(AnalyticsService.name);
  private pruneTimer: ReturnType<typeof setTimeout> | null = null;
  private pruneRunning = false;
  private destroyed = false;

  constructor(
    @InjectDataSource() private readonly db: DataSource,
    private readonly posthog: PostHogAnalyticsSink,
    private readonly posthogPrivacy: PostHogPrivacyService,
  ) {}

  onModuleInit(): void {
    this.destroyed = false;
    this.schedulePrune(INITIAL_PRUNE_DELAY_MS);
  }

  onModuleDestroy(): void {
    this.destroyed = true;
    if (this.pruneTimer) {
      clearTimeout(this.pruneTimer);
      this.pruneTimer = null;
    }
  }

  private subjectHash(userId: string): string {
    const key = process.env.ANALYTICS_HMAC_KEY?.trim();
    if (!key || key.length < 32) {
      throw new ServiceUnavailableException({
        code: 'analytics.not_configured',
        message: 'Product analytics is not configured.',
      });
    }
    return createHmac('sha256', key).update(userId).digest('hex');
  }

  private schedulePrune(delayMs: number): void {
    if (this.destroyed) return;

    this.pruneTimer = setTimeout(() => {
      this.pruneTimer = null;
      void this.runPrune()
        .then(() => {
          this.schedulePrune(PRUNE_INTERVAL_MS);
        })
        .catch(() => {
          this.logger.error('Product analytics retention sweep failed; retrying later.');
          this.schedulePrune(PRUNE_RETRY_DELAY_MS);
        });
    }, delayMs);

    if (typeof this.pruneTimer.unref === 'function') {
      this.pruneTimer.unref();
    }
  }

  private async runPrune(): Promise<void> {
    if (this.pruneRunning) return;
    this.pruneRunning = true;
    try {
      const retentionDays = resolveRetentionDays(process.env.ANALYTICS_RETENTION_DAYS);
      const cutoff = new Date(Date.now() - retentionDays * DAY_MS);
      await this.posthogPrivacy.enqueueRetentionDeletion(cutoff);
      await pruneExpiredAnalytics(this.db, retentionDays);
      await this.posthogPrivacy.processPending();
    } finally {
      this.pruneRunning = false;
    }
  }

  async record(
    userId: string,
    event: ProductAnalyticsEventName,
    properties?: ProductAnalyticsProperties,
  ): Promise<void> {
    if (!EVENT_SET.has(event)) {
      throw new BadRequestException({
        code: 'analytics.event_not_allowed',
        message: 'Analytics event is not allowed.',
      });
    }

    const subjectHash = this.subjectHash(userId);
    const safeProperties = sanitizeProductAnalyticsProperties(event, properties);

    await this.db.query(
      `WITH subject AS (
         INSERT INTO analytics_subjects (user_id, subject_hash, updated_at)
         VALUES ($1, $2, NOW())
         ON CONFLICT (user_id) DO UPDATE
           SET subject_hash = EXCLUDED.subject_hash,
               updated_at = NOW()
         RETURNING subject_hash
       )
       INSERT INTO analytics_events (subject_hash, event_name, properties)
       SELECT subject_hash, $3, $4::jsonb
       FROM subject`,
      [userId, subjectHash, event, JSON.stringify(safeProperties)],
    );

    // Postgres remains canonical. External analytics is a best-effort mirror and
    // never extends product-action latency or changes product success semantics.
    void this.posthog.capture(subjectHash, event, safeProperties);
  }
}
