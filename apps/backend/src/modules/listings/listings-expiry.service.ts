import {
  Inject,
  Injectable,
  Logger,
  OnModuleDestroy,
  OnModuleInit,
} from '@nestjs/common';
import { InjectDataSource } from '@nestjs/typeorm';
import { DataSource } from 'typeorm';
import type Redis from 'ioredis';
import { randomInt } from 'node:crypto';

import type { LatLng } from '@g88/shared';

import { REDIS_CLIENT } from '../../config/redis.provider';
import { DiscoveryRealtimePublisher } from '../../realtime/discovery-realtime.publisher';

const RECOVERY_WINDOW_DAYS = 7;
const CLAIM_TTL_SECONDS = 8 * 24 * 60 * 60;

interface ExpiredListingRow {
  id: string;
  expires_at: Date;
  lat: number;
  lng: number;
}

/**
 * Removes expired active listings from realtime discovery without changing
 * their product status. Expiry is a discoverability boundary; an expired
 * listing stays active so the seller can bump it and extend expires_at.
 *
 * The discoverable view already excludes expired listings from HTTP snapshots.
 * A versioned Redis claim makes the realtime boundary transition idempotent
 * across backend instances while allowing a later bumped expiry to claim its
 * own future transition.
 */
@Injectable()
export class ListingsExpiryService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(ListingsExpiryService.name);
  private timer: ReturnType<typeof setInterval> | null = null;
  private startupTimer: ReturnType<typeof setTimeout> | null = null;

  constructor(
    @InjectDataSource() private readonly db: DataSource,
    @Inject(REDIS_CLIENT) private readonly redis: Redis,
    private readonly discovery: DiscoveryRealtimePublisher,
  ) {}

  onModuleInit(): void {
    const delay = 30_000 + randomInt(0, 30_000);
    this.startupTimer = setTimeout(() => {
      this.startupTimer = null;
      void this.sweep();
      this.timer = setInterval(() => void this.sweep(), 60_000);
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
      const expired = (await this.db.query(
        `SELECT id, expires_at,
                ST_Y(location::geometry) AS lat,
                ST_X(location::geometry) AS lng
           FROM listings
          WHERE deleted_at IS NULL
            AND visibility = 'public'
            AND status = 'active'
            AND expires_at IS NOT NULL
            AND expires_at <= NOW()
            AND expires_at > NOW() - interval '${RECOVERY_WINDOW_DAYS} days'`,
      )) as ExpiredListingRow[];

      let published = 0;
      for (const listing of expired) {
        const claimKey = this.claimKey(listing);
        const claimed = await this.redis.set(
          claimKey,
          '1',
          'EX',
          CLAIM_TTL_SECONDS,
          'NX',
        );
        if (claimed !== 'OK') continue;

        try {
          await this.discovery.publishEntityChangeToSubscribers({
            kind: 'listing',
            entityId: listing.id,
            location: this.toLocation(listing),
            change: 'update',
          });
          published += 1;
        } catch (error) {
          await this.redis.del(claimKey).catch(() => undefined);
          this.logger.warn(
            `Listing discovery expiry publication failed for ${listing.id}: ${
              error instanceof Error ? error.message : String(error)
            }`,
          );
        }
      }

      if (published > 0) {
        this.logger.log(`Published ${published} listing discovery expiry transition(s).`);
      }
    } catch (err) {
      this.logger.warn(
        `Listing expiry sweep failed: ${err instanceof Error ? err.message : err}`,
      );
    }
  }

  private claimKey(row: ExpiredListingRow): string {
    return `discovery:listing-expiry:${row.id}:${new Date(row.expires_at).getTime()}`;
  }

  private toLocation(row: ExpiredListingRow): LatLng {
    return { lat: Number(row.lat), lng: Number(row.lng) };
  }
}
