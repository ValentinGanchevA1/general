import {
  Injectable,
  Logger,
  OnModuleDestroy,
  OnModuleInit,
} from '@nestjs/common';
import { InjectDataSource } from '@nestjs/typeorm';
import { DataSource } from 'typeorm';
import { randomInt } from 'node:crypto';

import type { LatLng } from '@g88/shared';

import { DiscoveryRealtimePublisher } from '../../realtime/discovery-realtime.publisher';

interface ExpiredListingRow {
  id: string;
  lat: number;
  lng: number;
}

/**
 * Removes expired active listings from realtime discovery.
 *
 * The discoverable view already excludes expired listings from HTTP snapshots.
 * This sweeper closes the realtime gap for clients that keep a socket
 * subscription open across the expiry boundary. Multiple backend instances may
 * sweep the same row; duplicate leave mutations are safe and idempotent.
 */
@Injectable()
export class ListingsExpiryService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(ListingsExpiryService.name);
  private timer: ReturnType<typeof setInterval> | null = null;
  private startupTimer: ReturnType<typeof setTimeout> | null = null;

  constructor(
    @InjectDataSource() private readonly db: DataSource,
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
        `UPDATE listings
            SET status = 'withdrawn', updated_at = NOW()
          WHERE deleted_at IS NULL
            AND status = 'active'
            AND expires_at IS NOT NULL
            AND expires_at <= NOW()
          RETURNING id,
                    ST_Y(location::geometry) AS lat,
                    ST_X(location::geometry) AS lng`,
      )) as ExpiredListingRow[];

      if (expired.length === 0) return;

      const results = await Promise.allSettled(
        expired.map((listing) =>
          this.discovery.publishEntityChangeToSubscribers({
            kind: 'listing',
            entityId: listing.id,
            location: this.toLocation(listing),
            change: 'update',
          }),
        ),
      );

      const failed = results.filter((result) => result.status === 'rejected').length;
      if (failed > 0) {
        this.logger.warn(
          `Expired ${expired.length} listings; ${failed} realtime discovery publications failed.`,
        );
        return;
      }

      this.logger.log(`Expired ${expired.length} listings and published discovery leaves.`);
    } catch (err) {
      this.logger.warn(
        `Listing expiry sweep failed: ${err instanceof Error ? err.message : err}`,
      );
    }
  }

  private toLocation(row: ExpiredListingRow): LatLng {
    return { lat: Number(row.lat), lng: Number(row.lng) };
  }
}
