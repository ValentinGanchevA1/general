import type { MapDiscoveryPoint, PlaceMapEntityPoint } from '@g88/shared';

type Listener = () => void;

const MAX_PUBLIC_PLACE_TRENDING_CANDIDATES = 8;

let points: readonly PlaceMapEntityPoint[] = [];
const listeners = new Set<Listener>();

function emit(): void {
  listeners.forEach((listener) => listener());
}

export function publicPlaceTrendingCandidates(
  source: readonly MapDiscoveryPoint[],
): readonly PlaceMapEntityPoint[] {
  return source
    .filter((point): point is PlaceMapEntityPoint => (
      point.kind === 'place' &&
      point.meta.trending === true &&
      point.meta.locationPrecision === 'coarse'
    ))
    .slice(0, MAX_PUBLIC_PLACE_TRENDING_CANDIDATES);
}

/**
 * UI-only mirror of the current public, thresholded Place entity lane.
 * It never contains private Saved/focused Places or cluster counts.
 */
export const publicPlaceTrendingStore = {
  getSnapshot(): readonly PlaceMapEntityPoint[] {
    return points;
  },

  subscribe(listener: Listener): () => void {
    listeners.add(listener);
    return () => listeners.delete(listener);
  },

  setFromDiscovery(source: readonly MapDiscoveryPoint[]): void {
    points = publicPlaceTrendingCandidates(source);
    emit();
  },

  clear(): void {
    if (points.length === 0) return;
    points = [];
    emit();
  },
};
