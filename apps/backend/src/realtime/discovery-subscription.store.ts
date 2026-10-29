import { Injectable } from '@nestjs/common';
import {
  isEntityZoom,
  type EntityKind,
  type LatLng,
  type MarketplaceDiscoverySubscriptionPayload,
  type Viewport,
} from '@g88/shared';

export interface ActiveDiscoverySubscription {
  socketId: string;
  viewerId: string;
  query: MarketplaceDiscoverySubscriptionPayload;
}

const SPATIAL_BUCKET_DEGREES = 1;
const LAT_BUCKET_COUNT = 180;
const LNG_BUCKET_COUNT = 360;

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

function latBucket(lat: number): number {
  return clamp(
    Math.floor((lat + 90) / SPATIAL_BUCKET_DEGREES),
    0,
    LAT_BUCKET_COUNT - 1,
  );
}

function lngBucket(lng: number): number {
  return clamp(
    Math.floor((lng + 180) / SPATIAL_BUCKET_DEGREES),
    0,
    LNG_BUCKET_COUNT - 1,
  );
}

function bucketKey(latIndex: number, lngIndex: number): string {
  return `${latIndex}:${lngIndex}`;
}

function longitudeRanges(viewport: Viewport): readonly (readonly [number, number])[] {
  if (viewport.sw.lng <= viewport.ne.lng) {
    return [[viewport.sw.lng, viewport.ne.lng]];
  }

  return [
    [viewport.sw.lng, 180],
    [-180, viewport.ne.lng],
  ];
}

function viewportBucketKeys(viewport: Viewport): Set<string> {
  const keys = new Set<string>();
  const minLatBucket = latBucket(viewport.sw.lat);
  const maxLatBucket = latBucket(viewport.ne.lat);

  for (let latIndex = minLatBucket; latIndex <= maxLatBucket; latIndex += 1) {
    for (const [minLng, maxLng] of longitudeRanges(viewport)) {
      const minLngBucket = lngBucket(minLng);
      const maxLngBucket = lngBucket(maxLng);
      for (let lngIndex = minLngBucket; lngIndex <= maxLngBucket; lngIndex += 1) {
        keys.add(bucketKey(latIndex, lngIndex));
      }
    }
  }

  return keys;
}

function pointBucketKey(point: LatLng): string {
  return bucketKey(latBucket(point.lat), lngBucket(point.lng));
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
  query: MarketplaceDiscoverySubscriptionPayload,
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
 * A coarse spatial bucket index narrows candidate lookup before exact viewport,
 * kind, and viewer-specific privacy/filter checks. The exact viewport predicate
 * remains authoritative, so bucket boundaries never change discovery semantics.
 */
@Injectable()
export class DiscoverySubscriptionStore {
  private readonly bySocket = new Map<string, ActiveDiscoverySubscription>();
  private readonly socketBucketKeys = new Map<string, Set<string>>();
  private readonly socketsByBucket = new Map<string, Set<string>>();

  set(
    socketId: string,
    viewerId: string,
    query: MarketplaceDiscoverySubscriptionPayload,
  ): void {
    this.removeFromSpatialIndex(socketId);

    const subscription = { socketId, viewerId, query };
    this.bySocket.set(socketId, subscription);

    const keys = viewportBucketKeys(query.viewport);
    this.socketBucketKeys.set(socketId, keys);
    for (const key of keys) {
      let sockets = this.socketsByBucket.get(key);
      if (sockets === undefined) {
        sockets = new Set<string>();
        this.socketsByBucket.set(key, sockets);
      }
      sockets.add(socketId);
    }
  }

  get(socketId: string): ActiveDiscoverySubscription | null {
    return this.bySocket.get(socketId) ?? null;
  }

  delete(socketId: string): void {
    this.bySocket.delete(socketId);
    this.removeFromSpatialIndex(socketId);
  }

  candidatesForEntity(
    kind: EntityKind,
    location: LatLng,
  ): ActiveDiscoverySubscription[] {
    const socketIds = this.socketsByBucket.get(pointBucketKey(location));
    if (socketIds === undefined) return [];

    const candidates: ActiveDiscoverySubscription[] = [];
    for (const socketId of socketIds) {
      const subscription = this.bySocket.get(socketId);
      if (subscription === undefined) continue;
      if (!subscriptionAllowsKind(subscription.query, kind)) continue;
      if (!viewportContains(subscription.query.viewport, location)) continue;

      candidates.push(subscription);
    }
    return candidates;
  }

  private removeFromSpatialIndex(socketId: string): void {
    const keys = this.socketBucketKeys.get(socketId);
    if (keys === undefined) return;

    for (const key of keys) {
      const sockets = this.socketsByBucket.get(key);
      if (sockets === undefined) continue;
      sockets.delete(socketId);
      if (sockets.size === 0) this.socketsByBucket.delete(key);
    }
    this.socketBucketKeys.delete(socketId);
  }
}
