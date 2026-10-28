import type { NexaSavedPlaceSummary, PlaceMapEntityPoint } from '@g88/shared';

type Listener = () => void;

export interface SavedPlaceMapFocusRequest {
  requestId: number;
  point: PlaceMapEntityPoint;
}

let request: SavedPlaceMapFocusRequest | null = null;
let nextRequestId = 1;
const listeners = new Set<Listener>();

function emit(): void {
  listeners.forEach((listener) => listener());
}

function toMapPoint(place: NexaSavedPlaceSummary): PlaceMapEntityPoint {
  return {
    kind: 'place',
    id: place.id,
    lat: place.approximateLocation.lat,
    lng: place.approximateLocation.lng,
    meta: {
      canonicalLabel: place.canonicalLabel,
      trending: place.trending,
      recentActivityAt: place.recentActivityAt,
      locationPrecision: 'coarse',
      saved: true,
    },
  };
}

/**
 * Session-scoped, viewer-private handoff from Saved Places to Map.
 * The payload is intentionally limited to the existing coarse place summary.
 */
export const savedPlaceMapFocusStore = {
  getSnapshot(): SavedPlaceMapFocusRequest | null {
    return request;
  },

  subscribe(listener: Listener): () => void {
    listeners.add(listener);
    return () => listeners.delete(listener);
  },

  request(place: NexaSavedPlaceSummary): void {
    request = {
      requestId: nextRequestId++,
      point: toMapPoint(place),
    };
    emit();
  },

  clear(): void {
    if (request === null) return;
    request = null;
    emit();
  },
};
