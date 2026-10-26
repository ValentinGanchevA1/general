import React from 'react';
import { getDiscoveryPointKey, type DiscoveryPointKey } from '@g88/shared';

import type { NexaMapController } from '../contracts/mapRenderer';
import type { MapRendererKind } from '../mapRenderer';
import { resolveAvailableMapRenderer } from '../mapRendererRuntime';
import { resolveRenderableMapSelection } from '../mapSelectionRuntime';
import { MapLibreMapSurface } from './mapLibre/MapLibreMapSurface';
import { LegacyMapSurface, type LegacyMapSurfaceProps } from './reactNativeMaps/LegacyMapSurface';

export interface NexaMapRuntimeSurfaceProps extends LegacyMapSurfaceProps {
  requestedRenderer: MapRendererKind;
  mapLibreAvailable: boolean;
  mapLibreStyleUrl: string | null;
}

/** Single runtime entry point for NEXA map rendering. */
export const NexaMapRuntimeSurface = React.forwardRef<
  NexaMapController,
  NexaMapRuntimeSurfaceProps
>(function NexaMapRuntimeSurface(
  {
    requestedRenderer,
    mapLibreAvailable,
    mapLibreStyleUrl,
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
    mapLibreConfigured: mapLibreStyleUrl !== null,
  });
  const renderableSelection = resolveRenderableMapSelection(
    points,
    selectedEntityKey,
    dimUnselected,
  );

  if (renderer === 'maplibre' && mapLibreStyleUrl !== null) {
    const pointsByKey = new Map<DiscoveryPointKey, (typeof points)[number]>(
      points.map((point) => [getDiscoveryPointKey(point), point]),
    );

    return (
      <MapLibreMapSurface
        ref={ref}
        mapStyle={mapLibreStyleUrl}
        points={points}
        selectedKey={renderableSelection.selectedEntityKey as DiscoveryPointKey | null}
        dimUnselected={renderableSelection.interactionFocused}
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
      selectedEntityKey={renderableSelection.selectedEntityKey}
      dimUnselected={renderableSelection.interactionFocused}
      onReady={onReady}
      onRegionChangeComplete={onRegionChangeComplete}
      onLongPress={onLongPress}
      onClusterPress={onClusterPress}
      onEntityPress={onEntityPress}
      {...surfaceProps}
    />
  );
});
