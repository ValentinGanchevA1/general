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

/**
 * Reprojects a discovery snapshot while preserving GeoJSON feature identity for
 * unchanged DiscoveryPoint objects. applyDiscoveryDiff already preserves those
 * point references, so MapLibre updates can avoid rebuilding unchanged feature
 * objects when a viewport diff touches only a subset of entities.
 */
export function updateMapFeatureCollection(
  previousPoints: readonly DiscoveryPoint[],
  previousCollection: NexaMapFeatureCollection,
  points: readonly DiscoveryPoint[],
): NexaMapFeatureCollection {
  const previousPointByKey = new Map<DiscoveryPointKey, DiscoveryPoint>();
  for (const point of previousPoints) {
    previousPointByKey.set(getDiscoveryPointKey(point), point);
  }

  const previousFeatureByKey = new Map<DiscoveryPointKey, NexaMapPointFeature>();
  for (const feature of previousCollection.features) {
    previousFeatureByKey.set(feature.id, feature);
  }

  return {
    type: 'FeatureCollection',
    features: points.map((point) => {
      const key = getDiscoveryPointKey(point);
      if (previousPointByKey.get(key) === point) {
        const previousFeature = previousFeatureByKey.get(key);
        if (previousFeature !== undefined) return previousFeature;
      }
      return discoveryPointToMapFeature(point);
    }),
  };
}

export const MAP_ENTITY_KINDS: readonly EntityKind[] = ['user', 'event', 'listing'];
