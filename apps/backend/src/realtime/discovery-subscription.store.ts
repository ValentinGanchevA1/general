import { Injectable } from '@nestjs/common';
import {
  isEntityZoom,
  type DiscoverySubscriptionPayload,
  type EntityKind,
  type LatLng,
  type Viewport,
} from '@g88/shared';

export interface ActiveDiscoverySubscription {
  socketId: string;
  viewerId: string;
  query: DiscoverySubscriptionPayload;
}

function viewportContains(viewport: Viewport, point: LatLng): boolean {
  if (point.lat < viewport.sw.lat || point.lat > viewport.ne.lat) return false;

  if (viewport.sw.lng <= viewport.ne.lng) {
    return point.lng >= viewport.sw.lng && point.lng <= viewport.ne.lng;
  }

  // Antimeridian-crossing viewport: [sw..180] U [-180..ne].
  return point.lng >= viewport.sw.lng || point.lng <= viewport.ne.lng;
}

function subscriptionAllowsKind(
  query: DiscoverySubscriptionPayload,
  kind: EntityKind,
): boolean {
  if (!isEntityZoom(query.zoom)) return false;
  if (query.topic !== undefined && kind === 'user') return false;
  if ((query.friendsOnly === true || query.datingOnly === true) && kind !== 'user') {
    return false;
  }
  return query.kinds === undefined || query.kinds.includes(kind);
}

/**
 * Process-local active discovery contexts, keyed by socket rather than user.
 * A user may have multiple devices/viewports. Candidate lookup must return all
 * matching local subscriptions; silently truncating the set leaves stale pins.
 * Viewer-specific privacy/filter resolution still happens downstream.
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

  candidatesForEntity(
    kind: EntityKind,
    location: LatLng,
  ): ActiveDiscoverySubscription[] {
    const candidates: ActiveDiscoverySubscription[] = [];
    for (const subscription of this.bySocket.values()) {
      if (!subscriptionAllowsKind(subscription.query, kind)) continue;
      if (!viewportContains(subscription.query.viewport, location)) continue;

      candidates.push(subscription);
    }
    return candidates;
  }
}
