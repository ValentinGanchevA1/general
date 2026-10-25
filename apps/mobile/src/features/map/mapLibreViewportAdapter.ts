import type { Viewport } from '@g88/shared';

import type {
  MapCameraState,
  NexaMapViewportChange,
} from './contracts/mapRenderer';

export type MapLibreLngLat = readonly [longitude: number, latitude: number];

export interface MapLibreViewStateSnapshot {
  center: MapLibreLngLat;
  zoom: number;
  bearing: number;
  pitch: number;
}

export interface MapLibreBoundsSnapshot {
  southWest: MapLibreLngLat;
  northEast: MapLibreLngLat;
}

function assertFinite(value: number, label: string): void {
  if (!Number.isFinite(value)) {
    throw new Error(`Invalid MapLibre ${label}`);
  }
}

function validateCoordinate(
  [longitude, latitude]: MapLibreLngLat,
  label: string,
): void {
  assertFinite(longitude, `${label} longitude`);
  assertFinite(latitude, `${label} latitude`);
  if (longitude < -180 || longitude > 180) {
    throw new Error(`Invalid MapLibre ${label} longitude`);
  }
  if (latitude < -90 || latitude > 90) {
    throw new Error(`Invalid MapLibre ${label} latitude`);
  }
}

export function mapLibreViewStateToCamera(
  snapshot: MapLibreViewStateSnapshot,
): MapCameraState {
  validateCoordinate(snapshot.center, 'center');
  assertFinite(snapshot.zoom, 'zoom');
  assertFinite(snapshot.bearing, 'bearing');
  assertFinite(snapshot.pitch, 'pitch');

  return {
    center: {
      longitude: snapshot.center[0],
      latitude: snapshot.center[1],
    },
    zoom: snapshot.zoom,
    bearing: snapshot.bearing,
    pitch: snapshot.pitch,
  };
}

export function mapLibreBoundsToViewport(
  bounds: MapLibreBoundsSnapshot,
): Viewport {
  validateCoordinate(bounds.southWest, 'south-west');
  validateCoordinate(bounds.northEast, 'north-east');

  return {
    sw: {
      lng: bounds.southWest[0],
      lat: bounds.southWest[1],
    },
    ne: {
      lng: bounds.northEast[0],
      lat: bounds.northEast[1],
    },
  };
}

export function mapLibreSnapshotToViewportChange(
  viewState: MapLibreViewStateSnapshot,
  bounds: MapLibreBoundsSnapshot,
): NexaMapViewportChange {
  return {
    camera: mapLibreViewStateToCamera(viewState),
    viewport: mapLibreBoundsToViewport(bounds),
  };
}
