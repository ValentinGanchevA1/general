import React from 'react';
import type MapView from 'react-native-maps';

import type { MapRendererKind } from '../mapRenderer';
import { resolveAvailableMapRenderer } from '../mapRendererRuntime';
import { MapLibreMapSurface } from './mapLibre/MapLibreMapSurface';
import {
  LegacyMapSurface,
  type LegacyMapSurfaceProps,
} from './reactNativeMaps/LegacyMapSurface';

export interface NexaMapRuntimeSurfaceProps extends LegacyMapSurfaceProps {
  requestedRenderer: MapRendererKind;
  mapLibreAvailable: boolean;
}

/**
 * Single runtime entry point for NEXA map rendering.
 *
 * Product rendering remains fail-closed because the rollout policy keeps
 * MapLibre unavailable. When an explicit validation policy requests MapLibre
 * and marks the native bundle available, this boundary mounts the native
 * surface and translates its viewport back into the legacy region callback.
 * Discovery rendering stays on the legacy renderer until native GeoJSON parity
 * is implemented.
 */
export const NexaMapRuntimeSurface = React.forwardRef<
  MapView,
  NexaMapRuntimeSurfaceProps
>(function NexaMapRuntimeSurface(
  {
    requestedRenderer,
    mapLibreAvailable,
    onReady,
    onRegionChangeComplete,
    ...surfaceProps
  },
  ref,
): React.JSX.Element {
  const renderer = resolveAvailableMapRenderer({
    requested: requestedRenderer,
    mapLibreAvailable,
  });

  if (renderer === 'maplibre') {
    return (
      <MapLibreMapSurface
        onReady={onReady}
        onViewportSettled={({ viewport, camera }) => {
          const latitudeDelta = Math.abs(viewport.ne.lat - viewport.sw.lat);
          const longitudeDelta = Math.abs(viewport.ne.lng - viewport.sw.lng);

          onRegionChangeComplete({
            latitude: camera.center.latitude,
            longitude: camera.center.longitude,
            latitudeDelta,
            longitudeDelta,
          });
        }}
      />
    );
  }

  return (
    <LegacyMapSurface
      ref={ref}
      onReady={onReady}
      onRegionChangeComplete={onRegionChangeComplete}
      {...surfaceProps}
    />
  );
});
