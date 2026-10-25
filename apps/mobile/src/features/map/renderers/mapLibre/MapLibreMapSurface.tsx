import React from 'react';
import { StyleSheet } from 'react-native';
import type { DiscoveryPoint, DiscoveryPointKey } from '@g88/shared';
import {
  Camera,
  GeoJSONSource,
  Layer,
  Map,
  type LayerSpecification,
  type MapRef,
} from '@maplibre/maplibre-react-native';

type GeoJSONSourcePressHandler = NonNullable<
  React.ComponentProps<typeof GeoJSONSource>['onPress']
>;
type MapLongPressHandler = NonNullable<React.ComponentProps<typeof Map>['onLongPress']>;
type CircleLayerSpecification = Extract<LayerSpecification, { type: 'circle' }>;
type CircleLayerFilter = NonNullable<CircleLayerSpecification['filter']>;
type CircleLayerPaint = NonNullable<CircleLayerSpecification['paint']>;
type CircleOpacity = NonNullable<CircleLayerPaint['circle-opacity']>;
type CircleColor = NonNullable<CircleLayerPaint['circle-color']>;
type CircleRadius = NonNullable<CircleLayerPaint['circle-radius']>;
type CameraRef = React.ElementRef<typeof Camera>;

import { discoveryToMapFeatureCollection } from '../../adapters/discoveryToGeoJson';
import type {
  MapCoordinate,
  NexaMapController,
  NexaMapViewportChange,
} from '../../contracts/mapRenderer';
import type { MapLibreBoundsSnapshot, MapLibreViewStateSnapshot } from '../../mapLibreAdapter';
import { mapLibreSnapshotToViewportChange } from '../../mapLibreAdapter';

const DEVELOPMENT_MAP_STYLE = 'https://demotiles.maplibre.org/style.json';
const DISCOVERY_SOURCE_ID = 'nexa-discovery';
const DISCOVERY_LAYER_ID = 'nexa-discovery-points';
const DISCOVERY_SELECTED_HALO_LAYER_ID = 'nexa-discovery-selected-halo';
const DISCOVERY_SELECTED_LAYER_ID = 'nexa-discovery-selected';
const SELECTION_TRANSITION = { duration: 180, delay: 0 } as const;
const DISCOVERY_KIND_COLOR: CircleColor = [
  'match',
  ['get', 'kind'],
  'cluster', '#7C3AED',
  'user', '#8B5CF6',
  'event', '#F59E0B',
  'listing', '#22C55E',
  '#8B5CF6',
];
const DISCOVERY_MARKER_RADIUS: CircleRadius = [
  'interpolate',
  ['linear'],
  ['zoom'],
  9,
  ['match', ['get', 'kind'], 'cluster', 10, 'event', 5, 'listing', 5, 4.5],
  13,
  ['match', ['get', 'kind'], 'cluster', 13, 'event', 8, 'listing', 8, 7],
  17,
  ['match', ['get', 'kind'], 'cluster', 16, 'event', 10, 'listing', 10, 9],
];
const DISCOVERY_SELECTED_RADIUS: CircleRadius = [
  'interpolate', ['linear'], ['zoom'], 9, 8, 13, 11, 17, 13,
];
const DISCOVERY_SELECTED_HALO_RADIUS: CircleRadius = [
  'interpolate', ['linear'], ['zoom'], 9, 13, 13, 18, 17, 21,
];

export interface MapLibreMapSurfaceProps {
  points: readonly DiscoveryPoint[];
  selectedKey: DiscoveryPointKey | null;
  dimUnselected: boolean;
  onReady: () => void;
  onPointPress: (key: DiscoveryPointKey) => void;
  onViewportSettled: (change: NexaMapViewportChange) => void;
  onLongPress: (coordinate: MapCoordinate) => void;
}

function isDiscoveryPointKey(value: unknown): value is DiscoveryPointKey {
  return typeof value === 'string' && /^(cluster|user|event|listing):.+$/.test(value);
}

/** Native MapLibre surface behind the guarded renderer path. */
export const MapLibreMapSurface = React.forwardRef<NexaMapController, MapLibreMapSurfaceProps>(
  function MapLibreMapSurface(
    {
      points,
      selectedKey,
      dimUnselected,
      onReady,
      onPointPress,
      onViewportSettled,
      onLongPress,
    },
    ref,
  ): React.JSX.Element {
    const mapRef = React.useRef<MapRef>(null);
    const cameraRef = React.useRef<CameraRef>(null);
    const data = React.useMemo(() => discoveryToMapFeatureCollection(points), [points]);

    React.useImperativeHandle(ref, () => ({
      flyTo(target, options) {
        cameraRef.current?.flyTo({
          center: [target.center.longitude, target.center.latitude],
          ...(target.zoom !== undefined ? { zoom: target.zoom } : {}),
          ...(target.bearing !== undefined ? { bearing: target.bearing } : {}),
          ...(target.pitch !== undefined ? { pitch: target.pitch } : {}),
          duration: options?.durationMs ?? 0,
        });
      },
      fitViewport(viewport, options) {
        const padding = options?.padding;
        cameraRef.current?.fitBounds(
          [viewport.sw.lng, viewport.sw.lat, viewport.ne.lng, viewport.ne.lat],
          {
            padding: {
              top: padding?.top ?? 0,
              right: padding?.right ?? 0,
              bottom: padding?.bottom ?? 0,
              left: padding?.left ?? 0,
            },
            duration: options?.durationMs ?? 0,
          },
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

    const handleLongPress = React.useCallback<MapLongPressHandler>(
      (event): void => {
        const [longitude, latitude] = event.nativeEvent.lngLat;
        onLongPress({ latitude, longitude });
      },
      [onLongPress],
    );

    const selectedFilter = React.useMemo<CircleLayerFilter>(
      () => ['==', ['id'], selectedKey ?? '__nexa-no-selection__'],
      [selectedKey],
    );
    const baseOpacity = React.useMemo<CircleOpacity>(
      () => (dimUnselected && selectedKey !== null
        ? ['case', ['==', ['id'], selectedKey], 0, 0.28]
        : 0.92),
      [dimUnselected, selectedKey],
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
        onLongPress={handleLongPress}
      >
        <Camera ref={cameraRef} />
        <GeoJSONSource id={DISCOVERY_SOURCE_ID} data={data} onPress={handlePress}>
          <Layer
            id={DISCOVERY_LAYER_ID}
            type="circle"
            paint={{
              'circle-color': DISCOVERY_KIND_COLOR,
              'circle-opacity': baseOpacity,
              'circle-opacity-transition': SELECTION_TRANSITION,
              'circle-radius': DISCOVERY_MARKER_RADIUS,
              'circle-stroke-color': '#FFFFFF',
              'circle-stroke-width': 1.5,
            }}
          />
          <Layer
            id={DISCOVERY_SELECTED_HALO_LAYER_ID}
            type="circle"
            filter={selectedFilter}
            paint={{
              'circle-color': DISCOVERY_KIND_COLOR,
              'circle-opacity': 0.2,
              'circle-opacity-transition': SELECTION_TRANSITION,
              'circle-radius': DISCOVERY_SELECTED_HALO_RADIUS,
              'circle-radius-transition': SELECTION_TRANSITION,
              'circle-stroke-color': DISCOVERY_KIND_COLOR,
              'circle-stroke-opacity': 0.5,
              'circle-stroke-opacity-transition': SELECTION_TRANSITION,
              'circle-stroke-width': 2,
            }}
          />
          <Layer
            id={DISCOVERY_SELECTED_LAYER_ID}
            type="circle"
            filter={selectedFilter}
            paint={{
              'circle-color': DISCOVERY_KIND_COLOR,
              'circle-opacity': 1,
              'circle-opacity-transition': SELECTION_TRANSITION,
              'circle-radius': DISCOVERY_SELECTED_RADIUS,
              'circle-radius-transition': SELECTION_TRANSITION,
              'circle-stroke-color': '#FFFFFF',
              'circle-stroke-width': 3,
              'circle-stroke-width-transition': SELECTION_TRANSITION,
            }}
          />
        </GeoJSONSource>
      </Map>
    );
  },
);
