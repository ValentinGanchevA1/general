import type { MapDiscoveryPoint } from '@g88/shared';

/**
 * Applies the existing client-side map search semantics to Place entities only.
 * Clusters are intentionally retained because their authoritative counts come
 * from discovery; selected/focused Place ids are retained so an active map
 * interaction never disappears underneath its sheet.
 */
export function filterPlaceMapSearch(
  points: readonly MapDiscoveryPoint[],
  query: string,
  preservedPlaceIds: ReadonlySet<string>,
): MapDiscoveryPoint[] {
  const normalizedQuery = query.trim().toLowerCase();
  if (normalizedQuery === '') return [...points];

  return points.filter((point) => {
    if (point.kind !== 'place') return true;
    if (preservedPlaceIds.has(point.id)) return true;
    return point.meta.canonicalLabel.toLowerCase().includes(normalizedQuery);
  });
}
