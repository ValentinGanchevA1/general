import type { DiscoveryPoint } from '@g88/shared';

import type { MapCameraState, MapCoordinate } from './contracts/mapRenderer';
import { discoveryPointsToGeoJson } from './adapters/discoveryToGeoJson';

/**
 * Technical-spike contract for the MapLibre v11 renderer.
 *
 * This module intentionally has no native MapLibre import. It defines the
 * renderer-independent data/camera boundary first so the native dependency can
 * be introduced without leaking SDK types into product code.
 */
export const MAPLIBRE_SPIKE_TARGET = {
  packageName: '@maplibre/maplibre-react-native',
  version: '11.5.0',
  minimumReactNative: '0.80.0',
  requiresNewArchitecture: true,
  serverAuthoritativeClustering: true,
  clientClustering: false,
  featureStateSelection: true,
} as const;

export interface MapLibreViewportSnapshot {
  camera: MapCameraState;
  center: MapCoordinate;
}

export interface MapLibreDiscoveryFrame {
  geoJson: ReturnType<typeof discoveryPointsToGeoJson>;
  selectedFeatureId: string | null;
}

export function buildMapLibreDiscoveryFrame(
  points: readonly DiscoveryPoint[],
  selectedFeatureId: string | null,
): MapLibreDiscoveryFrame {
  return {
    geoJson: discoveryPointsToGeoJson(points),
    selectedFeatureId,
  };
}

export function canEnableMapLibreRenderer(input: {
  baseMapReady: boolean;
  cameraParity: boolean;
  viewportParity: boolean;
  discoveryParity: boolean;
  selectionParity: boolean;
}): boolean {
  return (
    input.baseMapReady &&
    input.cameraParity &&
    input.viewportParity &&
    input.discoveryParity &&
    input.selectionParity
  );
}
