import { Inject, Injectable, Logger, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { InjectDataSource } from '@nestjs/typeorm';
import { DataSource } from 'typeorm';
import type Redis from 'ioredis';
import { randomInt, randomUUID } from 'node:crypto';

import { REDIS_CLIENT } from '../../config/redis.provider';
import { DiscoveryRealtimePublisher } from '../../realtime/discovery-realtime.publisher';

const SWEEP_INTERVAL_MS = 60_000;
const STARTUP_DELAY_MIN_MS = 10_000;
const STARTUP_JITTER_MS = 20_000;
const RECOVERY_WINDOW_DAYS = 7;
const LOCK_TTL_SECONDS = 120;
const DONE_TTL_SECONDS = 8 * 24 * 60 * 60;
const RELEASE_LOCK_SCRIPT = `
if redis.call('GET', KEYS[1]) == ARGV[1] then
  return redis.call('DEL', KEYS[1])
end
return 0
`;

interface ExpiredEventRow {
  id: string;
  lat: number;
  lng: number;
}

/**
 * Keeps long-lived realtime discovery subscriptions aligned with the existing
 * event retention rule in v_discoverable_entity: starts_at > NOW() - 1 day.
 *
 * A short Redis lock prevents concurrent multi-instance publication while a
 * longer done marker suppresses successful repeats. Each lock has a unique
 * ownership token and is released only by its owner, so a slow worker cannot
 * delete a replacement lock after its own TTL expires. If a process dies before
 * publishing, the lock expires quickly and another sweep can recover. We do not
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
        if (await this.redis.get(this.doneKey(row.id))) continue;

        const lockKey = this.lockKey(row.id);
        const lockToken = randomUUID();
        const locked = await this.redis.set(
          lockKey,
          lockToken,
          'EX',
          LOCK_TTL_SECONDS,
          'NX',
        );
        if (locked !== 'OK') continue;

        try {
          // Re-check after acquiring the lock: another instance may have
          // completed publication between our initial done check and lock win.
          if (await this.redis.get(this.doneKey(row.id))) continue;

          await this.discoveryRealtime.publishEntityChangeToSubscribers({
            kind: 'event',
            entityId: row.id,
            location: { lat: row.lat, lng: row.lng },
            change: 'update',
          });
          await this.redis.set(this.doneKey(row.id), '1', 'EX', DONE_TTL_SECONDS);
          published += 1;
        } catch (error) {
          this.logger.warn(
            `Event discovery expiry publication failed for ${row.id}: ${
              error instanceof Error ? error.message : String(error)
            }`,
          );
        } finally {
          await this.releaseLock(lockKey, lockToken);
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

  private async releaseLock(lockKey: string, lockToken: string): Promise<void> {
    await this.redis.eval(RELEASE_LOCK_SCRIPT, 1, lockKey, lockToken).catch(() => undefined);
  }

  private lockKey(eventId: string): string {
    return `discovery:event-expiry:lock:${eventId}`;
  }

  private doneKey(eventId: string): string {
    return `discovery:event-expiry:done:${eventId}`;
  }
}
