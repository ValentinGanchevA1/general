import {
  getDiscoveryPointKey,
  type DiscoveryPoint,
  type DiscoveryPointKey,
  type EntityKind,
} from '@g88/shared';

export interface NexaMapFeatureProperties {
  key: DiscoveryPointKey;
  kind: DiscoveryPoint['kind'];
  count: number | null;
  online: boolean;
  live: boolean;
  verification: string | null;
  listingMode: string | null;
}

export interface NexaMapPointFeature {
  type: 'Feature';
  id: DiscoveryPointKey;
  geometry: {
    type: 'Point';
    coordinates: [longitude: number, latitude: number];
  };
  properties: NexaMapFeatureProperties;
}

export interface NexaMapFeatureCollection {
  type: 'FeatureCollection';
  features: NexaMapPointFeature[];
}

function entityMeta(point: Exclude<DiscoveryPoint, { kind: 'cluster' }>): {
  online: boolean;
  live: boolean;
  verification: string | null;
  listingMode: string | null;
} {
  switch (point.kind) {
    case 'user':
      return {
        online: point.meta.online === true,
        live: false,
        verification: point.meta.verification ?? null,
        listingMode: null,
      };
    case 'event':
      return {
        online: false,
        live: false,
        verification: null,
        listingMode: null,
      };
    case 'listing':
      return {
        online: false,
        live: false,
        verification: null,
        listingMode: point.meta.mode ?? null,
      };
  }
}

export function discoveryPointToMapFeature(point: DiscoveryPoint): NexaMapPointFeature {
  const key = getDiscoveryPointKey(point);
  const state = point.kind === 'cluster'
    ? { online: false, live: false, verification: null, listingMode: null }
    : entityMeta(point);

  return {
    type: 'Feature',
    id: key,
    geometry: {
      type: 'Point',
      coordinates: [point.lng, point.lat],
    },
    properties: {
      key,
      kind: point.kind,
      count: point.kind === 'cluster' ? point.count : null,
      ...state,
    },
  };
}

export function discoveryToMapFeatureCollection(
  points: readonly DiscoveryPoint[],
): NexaMapFeatureCollection {
  return {
    type: 'FeatureCollection',
    features: points.map(discoveryPointToMapFeature),
  };
}

export const MAP_ENTITY_KINDS: readonly EntityKind[] = ['user', 'event', 'listing'];
