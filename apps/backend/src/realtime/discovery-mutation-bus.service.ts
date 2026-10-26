import { Inject, Injectable, Logger, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import type Redis from 'ioredis';

import type { EntityKind, LatLng } from '@g88/shared';

import { REDIS_CLIENT } from '../config/redis.provider';

const DISCOVERY_MUTATION_CHANNEL = 'discovery:mutations:v1';

export type DiscoveryMutation =
  | {
      type: 'change';
      kind: EntityKind;
      entityId: string;
      location: LatLng;
      change: 'enter' | 'update';
    }
  | {
      type: 'movement';
      kind: EntityKind;
      entityId: string;
      previousLocation: LatLng;
      location: LatLng;
    };

type DiscoveryMutationHandler = (mutation: DiscoveryMutation) => Promise<void>;

/**
 * Process-independent discovery mutation transport. Producers publish once to
 * Redis; every backend instance consumes the mutation and fans it out only to
 * its own process-local discovery subscriptions.
 */
@Injectable()
export class DiscoveryMutationBusService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(DiscoveryMutationBusService.name);
  private readonly subscriber: Redis;
  private handler: DiscoveryMutationHandler | null = null;

  constructor(@Inject(REDIS_CLIENT) private readonly redis: Redis) {
    this.subscriber = redis.duplicate();
  }

  async onModuleInit(): Promise<void> {
    this.subscriber.on('message', (channel, payload) => {
      if (channel !== DISCOVERY_MUTATION_CHANNEL || this.handler == null) return;

      const mutation = this.parseMutation(payload);
      if (mutation == null) return;

      void this.handler(mutation).catch((error: unknown) => {
        this.logger.error(`discovery mutation handler failed: ${String(error)}`);
      });
    });
    await this.subscriber.subscribe(DISCOVERY_MUTATION_CHANNEL);
  }

  async onModuleDestroy(): Promise<void> {
    await this.subscriber.unsubscribe(DISCOVERY_MUTATION_CHANNEL);
    this.subscriber.disconnect();
  }

  setHandler(handler: DiscoveryMutationHandler): void {
    this.handler = handler;
  }

  async publish(mutation: DiscoveryMutation): Promise<void> {
    await this.redis.publish(DISCOVERY_MUTATION_CHANNEL, JSON.stringify(mutation));
  }

  private parseMutation(payload: string): DiscoveryMutation | null {
    try {
      const parsed: unknown = JSON.parse(payload);
      if (!this.isMutation(parsed)) {
        this.logger.warn('ignored invalid discovery mutation payload');
        return null;
      }
      return parsed;
    } catch {
      this.logger.warn('ignored malformed discovery mutation payload');
      return null;
    }
  }

  private isMutation(value: unknown): value is DiscoveryMutation {
    if (typeof value !== 'object' || value == null) return false;
    const record = value as Record<string, unknown>;
    if (!this.isKind(record.kind) || typeof record.entityId !== 'string') return false;
    if (!this.isLocation(record.location)) return false;

    if (record.type === 'change') {
      return record.change === 'enter' || record.change === 'update';
    }
    if (record.type === 'movement') {
      return this.isLocation(record.previousLocation);
    }
    return false;
  }

  private isKind(value: unknown): value is EntityKind {
    return value === 'user' || value === 'event' || value === 'listing';
  }

  private isLocation(value: unknown): value is LatLng {
    if (typeof value !== 'object' || value == null) return false;
    const record = value as Record<string, unknown>;
    return (
      typeof record.lat === 'number' &&
      Number.isFinite(record.lat) &&
      record.lat >= -90 &&
      record.lat <= 90 &&
      typeof record.lng === 'number' &&
      Number.isFinite(record.lng) &&
      record.lng >= -180 &&
      record.lng <= 180
    );
  }
}
