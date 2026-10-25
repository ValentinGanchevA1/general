import React from 'react';
import { StyleSheet } from 'react-native';
import type { DiscoveryPoint } from '@g88/shared';
import {
  Camera,
  GeoJSONSource,
  Layer,
  Map,
  type MapRef,
} from '@maplibre/maplibre-react-native';

import { discoveryToMapFeatureCollection } from '../../adapters/discoveryToGeoJson';
import type { MapLibreBoundsSnapshot, MapLibreViewStateSnapshot } from '../../mapLibreAdapter';
import { mapLibreSnapshotToViewportChange } from '../../mapLibreAdapter';
import type { NexaMapViewportChange } from '../../contracts/mapRenderer';

const DEVELOPMENT_MAP_STYLE = 'https://demotiles.maplibre.org/style.json';
const DISCOVERY_SOURCE_ID = 'nexa-discovery';

export interface MapLibreMapSurfaceProps {
  points: readonly DiscoveryPoint[];
  onReady: () => void;
  onViewportSettled: (change: NexaMapViewportChange) => void;
}

/**
 * Native MapLibre surface for the guarded renderer path.
 *
 * The backend remains authoritative for H3 clustering, privacy filtering and
 * ranking. This source only renders the already-bounded DiscoveryPoint set and
 * intentionally allowlists properties instead of forwarding point metadata.
 */
export const MapLibreMapSurface = React.forwardRef<MapRef, MapLibreMapSurfaceProps>(
  function MapLibreMapSurface(
    { points, onReady, onViewportSettled },
    ref,
  ): React.JSX.Element {
    const localRef = React.useRef<MapRef>(null);
    const data = React.useMemo(() => discoveryToMapFeatureCollection(points), [points]);

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
        <GeoJSONSource id={DISCOVERY_SOURCE_ID} data={data}>
          <Layer
            id="nexa-discovery-points"
            type="circle"
            paint={{
              'circle-color': '#8B5CF6',
              'circle-opacity': 0.9,
              'circle-radius': ['case', ['==', ['get', 'kind'], 'cluster'], 12, 7],
              'circle-stroke-color': '#FFFFFF',
              'circle-stroke-width': 1.5,
            }}
          />
        </GeoJSONSource>
      </Map>
    );
  },
);
