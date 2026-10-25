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
type CircleLayerSpecification = Extract<LayerSpecification, { type: 'circle' }>;
type CircleLayerFilter = NonNullable<CircleLayerSpecification['filter']>;
type CircleLayerPaint = NonNullable<CircleLayerSpecification['paint']>;
type CircleOpacity = NonNullable<CircleLayerPaint['circle-opacity']>;
type CameraRef = React.ElementRef<typeof Camera>;

import { discoveryToMapFeatureCollection } from '../../adapters/discoveryToGeoJson';
import type { NexaMapController, NexaMapViewportChange } from '../../contracts/mapRenderer';
import type { MapLibreBoundsSnapshot, MapLibreViewStateSnapshot } from '../../mapLibreAdapter';
import { mapLibreSnapshotToViewportChange } from '../../mapLibreAdapter';

const DEVELOPMENT_MAP_STYLE = 'https://demotiles.maplibre.org/style.json';
const DISCOVERY_SOURCE_ID = 'nexa-discovery';
const DISCOVERY_LAYER_ID = 'nexa-discovery-points';
const DISCOVERY_SELECTED_HALO_LAYER_ID = 'nexa-discovery-selected-halo';
const DISCOVERY_SELECTED_LAYER_ID = 'nexa-discovery-selected';

export interface MapLibreMapSurfaceProps {
  points: readonly DiscoveryPoint[];
  selectedKey: DiscoveryPointKey | null;
  dimUnselected: boolean;
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
    { points, selectedKey, dimUnselected, onReady, onPointPress, onViewportSettled },
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
      >
        <Camera ref={cameraRef} />
        <GeoJSONSource id={DISCOVERY_SOURCE_ID} data={data} onPress={handlePress}>
          <Layer
            id={DISCOVERY_LAYER_ID}
            type="circle"
            paint={{
              'circle-color': [
                'match',
                ['get', 'kind'],
                'cluster', '#7C3AED',
                'user', '#8B5CF6',
                'event', '#F59E0B',
                'listing', '#22C55E',
                '#8B5CF6',
              ],
              'circle-opacity': baseOpacity,
              'circle-radius': [
                'match',
                ['get', 'kind'],
                'cluster', 13,
                'event', 8,
                'listing', 8,
                7,
              ],
              'circle-stroke-color': '#FFFFFF',
              'circle-stroke-width': 1.5,
            }}
          />
          <Layer
            id={DISCOVERY_SELECTED_HALO_LAYER_ID}
            type="circle"
            filter={selectedFilter}
            paint={{
              'circle-color': '#8B5CF6',
              'circle-opacity': 0.2,
              'circle-radius': 18,
              'circle-stroke-color': '#8B5CF6',
              'circle-stroke-opacity': 0.5,
              'circle-stroke-width': 2,
            }}
          />
          <Layer
            id={DISCOVERY_SELECTED_LAYER_ID}
            type="circle"
            filter={selectedFilter}
            paint={{
              'circle-color': '#8B5CF6',
              'circle-opacity': 1,
              'circle-radius': 11,
              'circle-stroke-color': '#FFFFFF',
              'circle-stroke-width': 3,
            }}
          />
        </GeoJSONSource>
      </Map>
    );
  },
);
