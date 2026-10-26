import { Injectable, Logger } from '@nestjs/common';
import type { LatLng } from '@g88/shared';

import { DiscoveryRealtimePublisher } from './discovery-realtime.publisher';

/**
 * Bridges presence movement into discovery realtime without making the core
 * RealtimeGateway depend on DiscoveryRealtimePublisher directly.
 */
@Injectable()
export class DiscoveryPresencePublisher {
  private readonly logger = new Logger(DiscoveryPresencePublisher.name);
  private readonly lastLocationByUser = new Map<string, LatLng>();

  constructor(private readonly discovery: DiscoveryRealtimePublisher) {}

  async publishHeartbeat(userId: string, location: LatLng): Promise<void> {
    const previousLocation = this.lastLocationByUser.get(userId);
    this.lastLocationByUser.set(userId, location);

    try {
      if (previousLocation !== undefined) {
        await this.discovery.publishEntityMovementToSubscribers({
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

  clear(userId: string): void {
    this.lastLocationByUser.delete(userId);
  }
}
