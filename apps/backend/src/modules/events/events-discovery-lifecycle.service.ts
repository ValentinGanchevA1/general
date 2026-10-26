import { Inject, Injectable, Logger, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { InjectDataSource } from '@nestjs/typeorm';
import { DataSource } from 'typeorm';
import type Redis from 'ioredis';
import { randomInt } from 'node:crypto';

import { REDIS_CLIENT } from '../../config/redis.provider';
import { DiscoveryRealtimePublisher } from '../../realtime/discovery-realtime.publisher';

const SWEEP_INTERVAL_MS = 60_000;
const STARTUP_DELAY_MIN_MS = 10_000;
const STARTUP_JITTER_MS = 20_000;
const RECOVERY_WINDOW_DAYS = 7;
const CLAIM_TTL_SECONDS = 8 * 24 * 60 * 60;

interface ExpiredEventRow {
  id: string;
  lat: number;
  lng: number;
}

/**
 * Keeps long-lived realtime discovery subscriptions aligned with the existing
 * event retention rule in v_discoverable_entity: starts_at > NOW() - 1 day.
 *
 * The Redis claim makes concurrent multi-instance sweeps idempotent. We do not
 * mutate event product state here; this service only publishes the discovery
 * boundary transition that HTTP queries already enforce.
 */
@Injectable()
export class EventsDiscoveryLifecycleService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(EventsDiscoveryLifecycleService.name);
  private timer: ReturnType<typeof setInterval> | null = null;
  private startupTimer: ReturnType<typeof setTimeout> | null = null;

  constructor(
    @InjectDataSource() private readonly db: DataSource,
    @Inject(REDIS_CLIENT) private readonly redis: Redis,
    private readonly discoveryRealtime: DiscoveryRealtimePublisher,
  ) {}

  onModuleInit(): void {
    const delay = STARTUP_DELAY_MIN_MS + randomInt(0, STARTUP_JITTER_MS);
    this.startupTimer = setTimeout(() => {
      this.startupTimer = null;
      void this.sweep();
      this.timer = setInterval(() => void this.sweep(), SWEEP_INTERVAL_MS);
    }, delay);
  }

  onModuleDestroy(): void {
    if (this.startupTimer !== null) clearTimeout(this.startupTimer);
    if (this.timer !== null) clearInterval(this.timer);
    this.startupTimer = null;
    this.timer = null;
  }

  async sweep(): Promise<void> {
    try {
      const rows = (await this.db.query(
        `SELECT id,
                ST_Y(location::geometry) AS lat,
                ST_X(location::geometry) AS lng
           FROM events
          WHERE deleted_at IS NULL
            AND visibility = 'public'
            AND starts_at <= NOW() - interval '1 day'
            AND starts_at > NOW() - interval '${RECOVERY_WINDOW_DAYS} days'`,
      )) as ExpiredEventRow[];

      let published = 0;
      for (const row of rows) {
        const claimed = await this.redis.set(
          `discovery:event-expiry:${row.id}`,
          '1',
          'EX',
          CLAIM_TTL_SECONDS,
          'NX',
        );
        if (claimed !== 'OK') continue;

        try {
          await this.discoveryRealtime.publishEntityChangeToSubscribers({
            kind: 'event',
            entityId: row.id,
            location: { lat: row.lat, lng: row.lng },
            change: 'update',
          });
          published += 1;
        } catch (error) {
          // Release the claim so the next sweep can retry publication.
          await this.redis.del(`discovery:event-expiry:${row.id}`).catch(() => undefined);
          this.logger.warn(
            `Event discovery expiry publication failed for ${row.id}: ${
              error instanceof Error ? error.message : String(error)
            }`,
          );
        }
      }

      if (published > 0) {
        this.logger.log(`Published ${published} event discovery expiry transition(s).`);
      }
    } catch (error) {
      this.logger.warn(
        `Event discovery lifecycle sweep failed: ${
          error instanceof Error ? error.message : String(error)
        }`,
      );
    }
  }
}
