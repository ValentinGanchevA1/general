import type { PlaceMapEntityPoint } from '@g88/shared';

import { formatPlaceActivityRecency } from '@/features/places/placeActivityRecency';
import type { TrendingItem } from './buildTrending';

export interface PlaceTrendingRow {
  id: string;
  kind: 'place';
  title: string;
  activityLabel: string;
  point: PlaceMapEntityPoint;
}

export type TrendingCardRow = TrendingItem | PlaceTrendingRow;

/**
 * Keep the existing top legacy entity first, then add at most one public Place.
 * This gives Places first-class visibility without letting one discovery family
 * consume the whole three-row Trending card.
 */
export function mergeTrendingWithPublicPlace(
  legacyItems: readonly TrendingItem[],
  publicPlaces: readonly PlaceMapEntityPoint[],
  limit = 3,
  nowMs = Date.now(),
): TrendingCardRow[] {
  if (limit <= 0) return [];

  const legacy = legacyItems.slice(0, limit);
  const place = publicPlaces[0];
  if (place == null) return legacy;

  const placeRow: PlaceTrendingRow = {
    id: place.id,
    kind: 'place',
    title: place.meta.canonicalLabel,
    activityLabel:
      formatPlaceActivityRecency(
        place.meta.trending,
        place.meta.recentActivityAt,
        nowMs,
      ) ?? 'Getting active nearby',
    point: place,
  };

  const [firstLegacy, ...remainingLegacy] = legacy;
  if (firstLegacy == null) return [placeRow];
  return [firstLegacy, placeRow, ...remainingLegacy].slice(0, limit);
}
