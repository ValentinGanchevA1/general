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
    dimUnselected,
    onReady,
    onRegionChangeComplete,
    onLongPress,
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
  const pointKeys = new Set<DiscoveryPointKey>(
    points.map((point) => getDiscoveryPointKey(point)),
  );
  const selectionIsRenderable =
    selectedEntityKey === null ||
    pointKeys.has(selectedEntityKey as DiscoveryPointKey);
  const effectiveSelectedEntityKey = selectionIsRenderable
    ? selectedEntityKey
    : null;
  const interactionFocused =
    selectionIsRenderable &&
    (dimUnselected || effectiveSelectedEntityKey !== null);

  if (renderer === 'maplibre') {
    const pointsByKey = new Map<DiscoveryPointKey, (typeof points)[number]>(
      points.map((point) => [getDiscoveryPointKey(point), point]),
    );

    return (
      <MapLibreMapSurface
        ref={ref}
        points={points}
        selectedKey={effectiveSelectedEntityKey as DiscoveryPointKey | null}
        dimUnselected={interactionFocused}
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
        onLongPress={onLongPress}
      />
    );
  }

  return (
    <LegacyMapSurface
      ref={ref}
      points={points}
      selectedEntityKey={effectiveSelectedEntityKey}
      dimUnselected={interactionFocused}
      onReady={onReady}
      onRegionChangeComplete={onRegionChangeComplete}
      onLongPress={onLongPress}
      onClusterPress={onClusterPress}
      onEntityPress={onEntityPress}
      {...surfaceProps}
    />
  );
});
