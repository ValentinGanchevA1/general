import React from 'react';
import { StyleSheet } from 'react-native';
import type { DiscoveryPoint, DiscoveryPointKey } from '@g88/shared';
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
const DISCOVERY_LAYER_ID = 'nexa-discovery-points';

export interface MapLibreMapSurfaceProps {
  points: readonly DiscoveryPoint[];
  selectedKey: DiscoveryPointKey | null;
  onReady: () => void;
  onPointPress: (key: DiscoveryPointKey) => void;
  onViewportSettled: (change: NexaMapViewportChange) => void;
}

function isDiscoveryPointKey(value: unknown): value is DiscoveryPointKey {
  return typeof value === 'string' && /^(cluster|user|event|listing):.+$/.test(value);
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
    { points, selectedKey, onReady, onPointPress, onViewportSettled },
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

    const handlePress = React.useCallback(
      (event: { features?: ReadonlyArray<{ id?: string | number | null }> }): void => {
        const key = event.features?.[0]?.id;
        if (isDiscoveryPointKey(key)) onPointPress(key);
      },
      [onPointPress],
    );

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
        <GeoJSONSource
          id={DISCOVERY_SOURCE_ID}
          data={data}
          onPress={handlePress}
        >
          <Layer
            id={DISCOVERY_LAYER_ID}
            type="circle"
            paint={{
              'circle-color': '#8B5CF6',
              'circle-opacity': 0.9,
              'circle-radius': [
                'case',
                ['==', ['id'], selectedKey ?? ''],
                11,
                ['==', ['get', 'kind'], 'cluster'],
                12,
                7,
              ],
              'circle-stroke-color': '#FFFFFF',
              'circle-stroke-width': [
                'case',
                ['==', ['id'], selectedKey ?? ''],
                3,
                1.5,
              ],
            }}
          />
        </GeoJSONSource>
      </Map>
    );
  },
);
