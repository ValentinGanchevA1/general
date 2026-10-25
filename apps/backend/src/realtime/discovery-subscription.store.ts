import { Injectable } from '@nestjs/common';
import type { DiscoverySubscriptionPayload } from '@g88/shared';

export interface ActiveDiscoverySubscription {
  socketId: string;
  viewerId: string;
  query: DiscoverySubscriptionPayload;
}

/**
 * Process-local active discovery contexts, keyed by socket rather than user.
 * A user may have multiple devices/viewports. This store intentionally does
 * not fan out events yet; candidate lookup is a separate bounded step.
 */
@Injectable()
export class DiscoverySubscriptionStore {
  private readonly bySocket = new Map<string, ActiveDiscoverySubscription>();

  set(socketId: string, viewerId: string, query: DiscoverySubscriptionPayload): void {
    this.bySocket.set(socketId, { socketId, viewerId, query });
  }

  get(socketId: string): ActiveDiscoverySubscription | null {
    return this.bySocket.get(socketId) ?? null;
  }

  delete(socketId: string): void {
    this.bySocket.delete(socketId);
  }
}
