import type { DiscoveryPoint, EntityKind, EntityPoint } from './api';
import type { LatLng } from './geo';

export type PlaceProvider = 'maptiler';

/** Provider-backed place identity used for canonical aggregation. */
export interface PlaceIdentity {
  provider: PlaceProvider;
  providerPlaceId: string;
  canonicalLabel: string;
  /** Coarse provider location only; exact venue coordinates are never sent to the backend. */
  providerCellH3R7: string;
}

/** Mobile search result. Exact center stays client-side for proximity-biased search/UI. */
export interface PlaceSuggestion extends PlaceIdentity {
  secondaryLabel: string | null;
  center: LatLng;
}

/** Public NEXA-owned place entity. Provider aliases and raw H3 never leave the backend. */
export interface NexaPlaceDetail {
  id: string;
  canonicalLabel: string;
  /** H3 r7 centroid for map focus only; this is intentionally approximate. */
  approximateLocation: LatLng;
  locationPrecision: 'coarse';
  /** True only while a k-anonymous place trend is active. */
  trending: boolean;
  /** Present only for an active thresholded trend. */
  recentActivityAt: string | null;
}

/**
 * Map-only extension of the legacy discovery kinds.
 * Core discovery/realtime remains user/event/listing while the map can opt into
 * privacy-safe place entities without widening every legacy consumer at once.
 */
export type MapEntityKind = EntityKind | 'place';

export interface PlaceMapMeta {
  canonicalLabel: string;
  /** Place pins are discoverable only while a k-anonymous trend is active. */
  trending: true;
  recentActivityAt: string;
  locationPrecision: 'coarse';
}

export interface PlaceMapEntityPoint {
  kind: 'place';
  id: string;
  /** H3 r7 centroid, never an exact venue coordinate. */
  lat: number;
  /** H3 r7 centroid, never an exact venue coordinate. */
  lng: number;
  meta: PlaceMapMeta;
  rankScore?: number;
}

export type MapEntityPoint = EntityPoint | PlaceMapEntityPoint;

export interface MapClusterPoint {
  kind: 'cluster';
  cellId: string;
  lat: number;
  lng: number;
  count: number;
  by: Partial<Record<MapEntityKind, number>>;
}

export type MapDiscoveryPoint = MapClusterPoint | MapEntityPoint;

export interface MapDiscoveryResponse {
  points: MapDiscoveryPoint[];
  resolution: number;
  generatedAt: string;
  viewportHash: string;
  /** Place discovery is full-snapshot only in this slice. */
  diff: null;
}

/** Legacy discovery points are valid map points by construction. */
export function asMapDiscoveryPoint(point: DiscoveryPoint): MapDiscoveryPoint {
  return point;
}
