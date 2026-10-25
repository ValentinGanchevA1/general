import React from 'react';
import { getDiscoveryPointKey, type DiscoveryPointKey } from '@g88/shared';

import type { NexaMapController } from '../contracts/mapRenderer';
import type { MapRendererKind } from '../mapRenderer';
import { resolveAvailableMapRenderer } from '../mapRendererRuntime';
import { MapLibreMapSurface } from './mapLibre/MapLibreMapSurface';
import { LegacyMapSurface, type LegacyMapSurfaceProps } from './reactNativeMaps/LegacyMapSurface';

export interface NexaMapRuntimeSurfaceProps extends LegacyMapSurfaceProps {
  requestedRenderer: MapRendererKind;
  mapLibreAvailable: boolean;
}

/** Single runtime entry point for NEXA map rendering. */
export const NexaMapRuntimeSurface = React.forwardRef<
  NexaMapController,
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
      points.map((point) => [getDiscoveryPointKey(point), point]),
    );

    return (
      <MapLibreMapSurface
        ref={ref}
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
          onRegionChangeComplete({
            latitude: camera.center.latitude,
            longitude: camera.center.longitude,
            latitudeDelta: Math.abs(viewport.ne.lat - viewport.sw.lat),
            longitudeDelta: Math.abs(viewport.ne.lng - viewport.sw.lng),
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
