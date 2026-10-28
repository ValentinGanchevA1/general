import type { MapDiscoveryPoint, MapEntityPoint } from '@g88/shared';

export type MapDiscoveryPointKey = string;

export function getMapDiscoveryPointKey(point: MapDiscoveryPoint): MapDiscoveryPointKey {
  return point.kind === 'cluster'
    ? `cluster:${point.cellId}`
    : `${point.kind}:${point.id}`;
}

export function getMapEntityKey(point: MapEntityPoint): MapDiscoveryPointKey {
  return `${point.kind}:${point.id}`;
}
