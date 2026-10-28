import type {
  DiscoveryPoint,
  MapClusterPoint,
  MapDiscoveryPoint,
  MapEntityKind,
  PlaceMapEntityPoint,
} from '@g88/shared';

const MAX_MAP_POINTS = 500;
const MAX_PLACE_ENTITY_POINTS = 80;
const MAX_PRIVATE_SAVED_POINTS = 120;

function isCluster(point: MapDiscoveryPoint): point is MapClusterPoint {
  return point.kind === 'cluster';
}

function isPlace(point: MapDiscoveryPoint): point is PlaceMapEntityPoint {
  return point.kind === 'place';
}

function addComposition(
  target: Partial<Record<MapEntityKind, number>>,
  source: Partial<Record<MapEntityKind, number>>,
): void {
  for (const [kind, count] of Object.entries(source) as Array<[MapEntityKind, number | undefined]>) {
    if (count == null || count <= 0) continue;
    target[kind] = (target[kind] ?? 0) + count;
  }
}

function mergePlaceEntities(
  publicPlaces: readonly PlaceMapEntityPoint[],
  savedPlaces: readonly PlaceMapEntityPoint[],
): PlaceMapEntityPoint[] {
  const byId = new Map<string, PlaceMapEntityPoint>();

  for (const point of publicPlaces.slice(0, MAX_PLACE_ENTITY_POINTS)) {
    byId.set(point.id, point);
  }
  for (const saved of savedPlaces.slice(0, MAX_PRIVATE_SAVED_POINTS)) {
    const publicPoint = byId.get(saved.id);
    if (publicPoint) {
      byId.set(saved.id, {
        ...saved,
        meta: {
          ...saved.meta,
          trending: publicPoint.meta.trending || saved.meta.trending,
          recentActivityAt: publicPoint.meta.recentActivityAt ?? saved.meta.recentActivityAt,
          saved: true,
        },
      });
      continue;
    }
    byId.set(saved.id, saved);
  }

  return [...byId.values()];
}

/**
 * Combines legacy discovery, the thresholded public place lane, and the viewer's
 * private saved-place overlay. Saved pins never contribute to public cluster
 * counts because a bookmark is not presence or popularity.
 */
export function mergeMapDiscoveryPoints(
  basePoints: DiscoveryPoint[],
  placePoints: MapDiscoveryPoint[],
  savedPlacePoints: MapDiscoveryPoint[] = [],
): MapDiscoveryPoint[] {
  const baseClusters = basePoints.filter((point) => point.kind === 'cluster');
  const placeClusters = placePoints.filter(isCluster);
  const savedPlaces = savedPlacePoints.filter(isPlace);
  const clusterMode = baseClusters.length > 0 || placeClusters.length > 0;

  if (clusterMode) {
    const byCell = new Map<string, MapClusterPoint>();
    const allClusters: MapClusterPoint[] = [
      ...baseClusters.map((cluster) => ({ ...cluster })),
      ...placeClusters,
    ];

    for (const cluster of allClusters) {
      const existing = byCell.get(cluster.cellId);
      if (!existing) {
        byCell.set(cluster.cellId, {
          ...cluster,
          by: { ...cluster.by },
        });
        continue;
      }
      existing.count += cluster.count;
      addComposition(existing.by, cluster.by);
    }

    const privatePins = savedPlaces.slice(0, MAX_PRIVATE_SAVED_POINTS);
    const remaining = Math.max(0, MAX_MAP_POINTS - privatePins.length);
    return [
      ...[...byCell.values()]
        .sort((left, right) => right.count - left.count)
        .slice(0, remaining),
      ...privatePins,
    ];
  }

  const places = mergePlaceEntities(placePoints.filter(isPlace), savedPlaces);
  const remaining = Math.max(0, MAX_MAP_POINTS - places.length);
  return [...places, ...basePoints.slice(0, remaining)];
}
