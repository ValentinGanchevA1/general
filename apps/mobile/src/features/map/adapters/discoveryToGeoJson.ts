import type { MapDiscoveryPoint, MapEntityKind, MapEntityPoint } from '@g88/shared';

import { getMapDiscoveryPointKey, type MapDiscoveryPointKey } from '../mapDiscoveryKeys';

export interface NexaMapFeatureProperties {
  key: MapDiscoveryPointKey;
  kind: MapDiscoveryPoint['kind'];
  count: number | null;
  online: boolean;
  live: boolean;
  saved: boolean;
  verification: string | null;
  listingMode: string | null;
}

export interface NexaMapPointFeature {
  type: 'Feature';
  id: MapDiscoveryPointKey;
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

function entityMeta(point: MapEntityPoint): {
  online: boolean;
  live: boolean;
  saved: boolean;
  verification: string | null;
  listingMode: string | null;
} {
  switch (point.kind) {
    case 'user':
      return {
        online: point.meta.online === true,
        live: false,
        saved: false,
        verification: point.meta.verification ?? null,
        listingMode: null,
      };
    case 'event':
      return {
        online: false,
        live: false,
        saved: false,
        verification: null,
        listingMode: null,
      };
    case 'listing':
      return {
        online: false,
        live: false,
        saved: false,
        verification: null,
        listingMode: point.meta.mode ?? null,
      };
    case 'place':
      return {
        online: false,
        live: point.meta.trending,
        saved: point.meta.saved === true,
        verification: null,
        listingMode: null,
      };
  }
}

export function discoveryPointToMapFeature(point: MapDiscoveryPoint): NexaMapPointFeature {
  const key = getMapDiscoveryPointKey(point);
  const state = point.kind === 'cluster'
    ? {
      online: false,
      live: false,
      saved: false,
      verification: null,
      listingMode: null,
    }
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
  points: readonly MapDiscoveryPoint[],
): NexaMapFeatureCollection {
  return {
    type: 'FeatureCollection',
    features: points.map(discoveryPointToMapFeature),
  };
}

export function updateMapFeatureCollection(
  previousPoints: readonly MapDiscoveryPoint[],
  previousCollection: NexaMapFeatureCollection,
  points: readonly MapDiscoveryPoint[],
): NexaMapFeatureCollection {
  const snapshotUnchanged =
    previousPoints.length === points.length &&
    points.every((point, index) => previousPoints[index] === point);
  if (snapshotUnchanged) return previousCollection;

  const previousPointByKey = new Map<MapDiscoveryPointKey, MapDiscoveryPoint>();
  for (const point of previousPoints) {
    previousPointByKey.set(getMapDiscoveryPointKey(point), point);
  }

  const previousFeatureByKey = new Map<MapDiscoveryPointKey, NexaMapPointFeature>();
  for (const feature of previousCollection.features) {
    previousFeatureByKey.set(feature.id, feature);
  }

  return {
    type: 'FeatureCollection',
    features: points.map((point) => {
      const key = getMapDiscoveryPointKey(point);
      if (previousPointByKey.get(key) === point) {
        const previousFeature = previousFeatureByKey.get(key);
        if (previousFeature !== undefined) return previousFeature;
      }
      return discoveryPointToMapFeature(point);
    }),
  };
}

export const MAP_ENTITY_KINDS: readonly MapEntityKind[] = ['user', 'event', 'listing', 'place'];
