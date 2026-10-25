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

type GeoJSONSourcePressHandler = NonNullable<
  React.ComponentProps<typeof GeoJSONSource>['onPress']
>;
type CameraRef = React.ElementRef<typeof Camera>;

import { discoveryToMapFeatureCollection } from '../../adapters/discoveryToGeoJson';
import type { NexaMapController, NexaMapViewportChange } from '../../contracts/mapRenderer';
import type { MapLibreBoundsSnapshot, MapLibreViewStateSnapshot } from '../../mapLibreAdapter';
import { mapLibreSnapshotToViewportChange } from '../../mapLibreAdapter';

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

/** Native MapLibre surface behind the guarded renderer path. */
export const MapLibreMapSurface = React.forwardRef<NexaMapController, MapLibreMapSurfaceProps>(
  function MapLibreMapSurface(
    { points, selectedKey, onReady, onPointPress, onViewportSettled },
    ref,
  ): React.JSX.Element {
    const mapRef = React.useRef<MapRef>(null);
    const cameraRef = React.useRef<CameraRef>(null);
    const data = React.useMemo(() => discoveryToMapFeatureCollection(points), [points]);

    React.useImperativeHandle(ref, () => ({
      flyTo(target, options) {
        cameraRef.current?.setCamera({
          centerCoordinate: [target.center.longitude, target.center.latitude],
          ...(target.zoom !== undefined ? { zoomLevel: target.zoom } : {}),
          ...(target.bearing !== undefined ? { heading: target.bearing } : {}),
          ...(target.pitch !== undefined ? { pitch: target.pitch } : {}),
          animationDuration: options?.durationMs ?? 0,
        });
      },
      fitViewport(viewport, options) {
        const padding = options?.padding;
        cameraRef.current?.fitBounds(
          [viewport.ne.lng, viewport.ne.lat],
          [viewport.sw.lng, viewport.sw.lat],
          [
            padding?.top ?? 0,
            padding?.right ?? 0,
            padding?.bottom ?? 0,
            padding?.left ?? 0,
          ],
          options?.durationMs ?? 0,
        );
      },
    }), []);

    const handleRegionDidChange = React.useCallback(async (): Promise<void> => {
      const map = mapRef.current;
      if (map === null) return;

      const [viewState, bounds] = await Promise.all([map.getViewState(), map.getBounds()]);
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
      onViewportSettled(mapLibreSnapshotToViewportChange(viewStateSnapshot, boundsSnapshot));
    }, [onViewportSettled]);

    const handlePress = React.useCallback<GeoJSONSourcePressHandler>(
      (event): void => {
        const key = event.nativeEvent.features?.[0]?.id;
        if (isDiscoveryPointKey(key)) onPointPress(key);
      },
      [onPointPress],
    );

    return (
      <Map
        ref={mapRef}
        mapStyle={DEVELOPMENT_MAP_STYLE}
        style={StyleSheet.absoluteFill}
        attribution={false}
        logo={false}
        compass={false}
        onDidFinishLoadingMap={onReady}
        onRegionDidChange={() => { void handleRegionDidChange(); }}
      >
        <Camera ref={cameraRef} />
        <GeoJSONSource id={DISCOVERY_SOURCE_ID} data={data} onPress={handlePress}>
          <Layer
            id={DISCOVERY_LAYER_ID}
            type="circle"
            paint={{
              'circle-color': '#8B5CF6',
              'circle-opacity': 0.9,
              'circle-radius': ['case', ['==', ['id'], selectedKey ?? ''], 11, ['==', ['get', 'kind'], 'cluster'], 12, 7],
              'circle-stroke-color': '#FFFFFF',
              'circle-stroke-width': ['case', ['==', ['id'], selectedKey ?? ''], 3, 1.5],
            }}
          />
        </GeoJSONSource>
      </Map>
    );
  },
);
