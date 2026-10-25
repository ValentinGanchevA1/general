import React from 'react';
import { StyleSheet } from 'react-native';
import {
  Camera,
  Map,
  type MapRef,
} from '@maplibre/maplibre-react-native';

import type { MapLibreBoundsSnapshot, MapLibreViewStateSnapshot } from '../../mapLibreAdapter';
import { mapLibreSnapshotToViewportChange } from '../../mapLibreAdapter';
import type { NexaMapViewportChange } from '../../contracts/mapRenderer';

const DEVELOPMENT_MAP_STYLE = 'https://demotiles.maplibre.org/style.json';

export interface MapLibreMapSurfaceProps {
  onReady: () => void;
  onViewportSettled: (change: NexaMapViewportChange) => void;
}

/**
 * Minimal native MapLibre validation surface.
 *
 * Discovery layers intentionally do not live here yet. Server-authoritative H3
 * points remain on the legacy renderer until the native GeoJSON layer slice is
 * parity-tested. This surface only proves map loading and renderer-neutral
 * viewport/camera translation behind the fail-closed rollout gate.
 */
export const MapLibreMapSurface = React.forwardRef<MapRef, MapLibreMapSurfaceProps>(
  function MapLibreMapSurface(
    { onReady, onViewportSettled },
    ref,
  ): React.JSX.Element {
    const localRef = React.useRef<MapRef>(null);

    React.useImperativeHandle(ref, () => {
      if (localRef.current === null) {
        throw new Error('MapLibre map ref is not ready');
      }
      return localRef.current;
    });

    const handleRegionDidChange = React.useCallback(async (): Promise<void> => {
      const map = localRef.current;
      if (map === null) return;

      const [viewState, bounds] = await Promise.all([
        map.getViewState(),
        map.getBounds(),
      ]);

      const viewStateSnapshot: MapLibreViewStateSnapshot = {
        center: [viewState.center[0], viewState.center[1]],
        zoom: viewState.zoom,
        bearing: viewState.bearing,
        pitch: viewState.pitch,
      };
      const boundsSnapshot: MapLibreBoundsSnapshot = {
        southWest: [bounds[0], bounds[1]],
        northEast: [bounds[2], bounds[3]],
      };

      onViewportSettled(
        mapLibreSnapshotToViewportChange(viewStateSnapshot, boundsSnapshot),
      );
    }, [onViewportSettled]);

    return (
      <Map
        ref={localRef}
        mapStyle={DEVELOPMENT_MAP_STYLE}
        style={StyleSheet.absoluteFill}
        attribution={false}
        logo={false}
        compass={false}
        onDidFinishLoadingMap={onReady}
        onRegionDidChange={() => {
          void handleRegionDidChange();
        }}
      >
        <Camera />
      </Map>
    );
  },
);
