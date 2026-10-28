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
