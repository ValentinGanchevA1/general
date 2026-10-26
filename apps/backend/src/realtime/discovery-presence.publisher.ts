import { Inject, Injectable, Logger } from '@nestjs/common';
import type Redis from 'ioredis';
import type { LatLng } from '@g88/shared';

import { REDIS_CLIENT } from '../config/redis.provider';
import { DiscoveryRealtimePublisher } from './discovery-realtime.publisher';

const LOCATION_KEY_PREFIX = 'discovery:presence-location:';
const LOCATION_TTL_SECONDS = 180;

/**
 * Adapts presence heartbeats into discovery entity changes while retaining the
 * previous fuzzed location required for movement-aware leave routing.
 *
 * Movement history lives in Redis so reconnects or heartbeats handled by a
 * different backend instance still route leaves from the previous location.
 */
@Injectable()
export class DiscoveryPresencePublisher {
  private readonly logger = new Logger(DiscoveryPresencePublisher.name);

  constructor(
    private readonly discovery: DiscoveryRealtimePublisher,
    @Inject(REDIS_CLIENT) private readonly redis: Redis,
  ) {}

  async publishHeartbeat(userId: string, location: LatLng): Promise<void> {
    try {
      const previousLocation = await this.swapLocation(userId, location);
      if (previousLocation !== null) {
        await this.discovery.publishEntityMovement({
          kind: 'user',
          entityId: userId,
          previousLocation,
          location,
        });
        return;
      }

      await this.discovery.publishEntityChangeToSubscribers({
        kind: 'user',
        entityId: userId,
        location,
        change: 'update',
      });
    } catch (error) {
      this.logger.error(`discovery presence publish failed user=${userId}: ${String(error)}`);
    }
  }

  async clear(userId: string): Promise<void> {
    try {
      await this.redis.del(this.locationKey(userId));
    } catch (error) {
      this.logger.error(`discovery presence clear failed user=${userId}: ${String(error)}`);
    }
  }

  private async swapLocation(userId: string, location: LatLng): Promise<LatLng | null> {
    const key = this.locationKey(userId);
    const serialized = JSON.stringify(location);
    const previous = await this.redis.getset(key, serialized);
    await this.redis.expire(key, LOCATION_TTL_SECONDS);
    return this.parseLocation(previous);
  }

  private parseLocation(value: string | null): LatLng | null {
    if (value === null) return null;
    try {
      const parsed: unknown = JSON.parse(value);
      if (typeof parsed !== 'object' || parsed === null) return null;
      const record = parsed as Record<string, unknown>;
      if (
        typeof record.lat !== 'number' ||
        !Number.isFinite(record.lat) ||
        record.lat < -90 ||
        record.lat > 90 ||
        typeof record.lng !== 'number' ||
        !Number.isFinite(record.lng) ||
        record.lng < -180 ||
        record.lng > 180
      ) {
        return null;
      }
      return { lat: record.lat, lng: record.lng };
    } catch {
      return null;
    }
  }

  private locationKey(userId: string): string {
    return `${LOCATION_KEY_PREFIX}${userId}`;
  }
}
