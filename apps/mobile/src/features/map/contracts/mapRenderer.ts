import type { DiscoveryPoint, DiscoveryPointKey, Viewport } from '@g88/shared';

export interface MapCoordinate {
  latitude: number;
  longitude: number;
}

export interface MapCameraState {
  center: MapCoordinate;
  zoom: number;
  bearing: number;
  pitch: number;
}

export interface MapCameraPadding {
  top: number;
  right: number;
  bottom: number;
  left: number;
}

export interface MapCameraTransitionOptions {
  durationMs?: number;
  padding?: Partial<MapCameraPadding>;
}

export interface MapCameraTarget {
  center: MapCoordinate;
  zoom?: number;
  bearing?: number;
  pitch?: number;
}

export interface NexaMapController {
  flyTo(target: MapCameraTarget, options?: MapCameraTransitionOptions): void;
  fitViewport(viewport: Viewport, options?: MapCameraTransitionOptions): void;
}

export interface NexaMapViewportChange {
  viewport: Viewport;
  camera: MapCameraState;
}

export interface NexaMapSurfaceProps {
  points: readonly DiscoveryPoint[];
  selectedKey: DiscoveryPointKey | null;
  onPointPress: (key: DiscoveryPointKey) => void;
  onViewportSettled: (change: NexaMapViewportChange) => void;
  onLongPress?: (coordinate: MapCoordinate) => void;
}
