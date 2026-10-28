import type {
  NexaPlaceDetail,
  NexaSavedPlaceSummary,
  PlaceMapEntityPoint,
} from '@g88/shared';

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

function setPoint(point: PlaceMapEntityPoint): void {
  request = {
    requestId: nextRequestId++,
    point,
  };
  emit();
}

function savedSummaryToMapPoint(place: NexaSavedPlaceSummary): PlaceMapEntityPoint {
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

function placeDetailToMapPoint(place: NexaPlaceDetail): PlaceMapEntityPoint {
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
      saved: place.saved,
    },
  };
}

/**
 * Session-scoped, viewer-private handoff to Map.
 * Payloads are intentionally limited to existing coarse NEXA place data.
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
    setPoint(savedSummaryToMapPoint(place));
  },

  requestDetail(place: NexaPlaceDetail): void {
    setPoint(placeDetailToMapPoint(place));
  },

  clear(): void {
    if (request === null) return;
    request = null;
    emit();
  },
};
