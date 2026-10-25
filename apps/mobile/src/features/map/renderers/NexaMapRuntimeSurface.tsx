import React from 'react';
import type { DiscoveryPointKey } from '@g88/shared';
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
 * surface and translates its viewport and point presses back into the legacy
 * screen contract until the renderer-neutral controller boundary lands.
 */
export const NexaMapRuntimeSurface = React.forwardRef<
  MapView,
  NexaMapRuntimeSurfaceProps
>(function NexaMapRuntimeSurface(
  {
    requestedRenderer,
    mapLibreAvailable,
    points,
    selectedEntityKey,
    onReady,
    onRegionChangeComplete,
    onClusterPress,
    onEntityPress,
    ...surfaceProps
  },
  ref,
): React.JSX.Element {
  const renderer = resolveAvailableMapRenderer({
    requested: requestedRenderer,
    mapLibreAvailable,
  });

  if (renderer === 'maplibre') {
    const pointsByKey = new Map<DiscoveryPointKey, (typeof points)[number]>(
      points.map((point) => {
        const key: DiscoveryPointKey = point.kind === 'cluster'
          ? `cluster:${point.cellId}`
          : `${point.kind}:${point.id}`;
        return [key, point];
      }),
    );

    return (
      <MapLibreMapSurface
        points={points}
        selectedKey={selectedEntityKey as DiscoveryPointKey | null}
        onReady={onReady}
        onPointPress={(key) => {
          const point = pointsByKey.get(key);
          if (point === undefined) return;
          if (point.kind === 'cluster') onClusterPress(point);
          else onEntityPress(point);
        }}
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
      points={points}
      selectedEntityKey={selectedEntityKey}
      onReady={onReady}
      onRegionChangeComplete={onRegionChangeComplete}
      onClusterPress={onClusterPress}
      onEntityPress={onEntityPress}
      {...surfaceProps}
    />
  );
});
