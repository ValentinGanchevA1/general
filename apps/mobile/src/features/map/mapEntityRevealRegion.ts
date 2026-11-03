import { ENTITY_ZOOM_THRESHOLD } from '@g88/shared';
import type { Region } from 'react-native-maps';

const MIN_DISCOVERY_DELTA = 0.005;
const DEFAULT_DISCOVERY_DELTA = 0.05;
const CLUSTER_DRILL_FACTOR = 2.5;
const ENTITY_REVEAL_ZOOM_MARGIN = 0.25;

export interface MapRevealCenter {
  lat: number;
  lng: number;
}

/**
 * Build a camera region that both zooms in naturally and guarantees that the
 * next discovery request crosses the shared entity/cluster threshold.
 *
 * Keeping the threshold itself unchanged preserves low-zoom aggregation and
 * avoids exposing individual people over a wider viewport.
 */
export function regionForEntityReveal(
  region: Region | null,
  center: MapRevealCenter,
): Region {
  const currentLatitudeDelta = Math.max(
    MIN_DISCOVERY_DELTA,
    region?.latitudeDelta ?? DEFAULT_DISCOVERY_DELTA,
  );
  const currentLongitudeDelta = Math.max(
    MIN_DISCOVERY_DELTA,
    region?.longitudeDelta ?? DEFAULT_DISCOVERY_DELTA,
  );
  const entityRevealLatitudeDelta =
    360 / 2 ** (ENTITY_ZOOM_THRESHOLD + ENTITY_REVEAL_ZOOM_MARGIN);
  const latitudeDelta = Math.max(
    MIN_DISCOVERY_DELTA,
    Math.min(currentLatitudeDelta / CLUSTER_DRILL_FACTOR, entityRevealLatitudeDelta),
  );
  const aspectRatio = currentLongitudeDelta / currentLatitudeDelta;
  const longitudeDelta = Math.max(
    MIN_DISCOVERY_DELTA,
    latitudeDelta * aspectRatio,
  );

  return {
    latitude: center.lat,
    longitude: center.lng,
    latitudeDelta,
    longitudeDelta,
  };
}
