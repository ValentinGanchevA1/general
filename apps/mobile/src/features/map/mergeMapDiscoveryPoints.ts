import type {
  DiscoveryPoint,
  MapClusterPoint,
  MapDiscoveryPoint,
  MapEntityKind,
} from '@g88/shared';

const MAX_MAP_POINTS = 500;
const MAX_PLACE_ENTITY_POINTS = 80;

function isCluster(point: MapDiscoveryPoint): point is MapClusterPoint {
  return point.kind === 'cluster';
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

/**
 * Combines legacy discovery with the separate thresholded place lane.
 * Cluster counts represent entity counts only; place user/check-in counts never
 * enter this function or the map payload.
 */
export function mergeMapDiscoveryPoints(
  basePoints: DiscoveryPoint[],
  placePoints: MapDiscoveryPoint[],
): MapDiscoveryPoint[] {
  const baseClusters = basePoints.filter((point) => point.kind === 'cluster');
  const placeClusters = placePoints.filter(isCluster);
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

    return [...byCell.values()]
      .sort((left, right) => right.count - left.count)
      .slice(0, MAX_MAP_POINTS);
  }

  const places = placePoints
    .filter((point) => point.kind === 'place')
    .slice(0, MAX_PLACE_ENTITY_POINTS);
  const remaining = Math.max(0, MAX_MAP_POINTS - places.length);
  return [...places, ...basePoints.slice(0, remaining)];
}
