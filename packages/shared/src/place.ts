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
