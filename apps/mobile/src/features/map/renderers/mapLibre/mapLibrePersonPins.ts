import type { MapDiscoveryPoint, MapEntityPoint } from '@g88/shared';

export type MapLibrePersonPoint = Extract<MapEntityPoint, { kind: 'user' }>;

export interface MapLibreDiscoveryPartition {
  personPoints: MapLibrePersonPoint[];
  layerPoints: MapDiscoveryPoint[];
}

/**
 * Individual people use interactive native markers so the map can show the
 * existing NEXA avatar treatment. Clusters and non-person entities stay in the
 * GeoJSON layer for scalable rendering and low-zoom clustering.
 */
export function partitionMapLibreDiscoveryPoints(
  points: readonly MapDiscoveryPoint[],
): MapLibreDiscoveryPartition {
  const personPoints: MapLibrePersonPoint[] = [];
  const layerPoints: MapDiscoveryPoint[] = [];

  for (const point of points) {
    if (point.kind === 'user') {
      personPoints.push(point);
    } else {
      layerPoints.push(point);
    }
  }

  return { personPoints, layerPoints };
}
