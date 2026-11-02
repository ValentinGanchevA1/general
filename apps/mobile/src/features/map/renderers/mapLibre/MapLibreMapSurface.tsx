import React from 'react';
import { StyleSheet } from 'react-native';
import type { MapDiscoveryPoint } from '@g88/shared';
import {
  Camera,
  GeoJSONSource,
  Layer,
  Map,
  Marker,
  type LayerSpecification,
  type MapRef,
} from '@maplibre/maplibre-react-native';

import { EntityMarker } from '@/components/map/EntityMarker';
import {
  limitVisibleMapPoints,
  resolveNexaMapZoomPolicy,
  type NexaMapZoomPolicy,
} from '@/components/map/nexaMapZoomDensity';
import { resolvePersonMarkerAvatarUrl } from '@/components/map/nexaPersonMarkerMedia';
import { useNexaReducedMotion } from '@/motion/useNexaReducedMotion';
import { resolveAvatarUri } from '@/services/avatarCache';
import { getMapEntityKey, type MapDiscoveryPointKey } from '../../mapDiscoveryKeys';
import { discoveryToMapFeatureCollection } from '../../adapters/discoveryToGeoJson';
import type {
  MapCoordinate,
  NexaMapController,
  NexaMapViewportChange,
} from '../../contracts/mapRenderer';
import type { MapLibreBoundsSnapshot, MapLibreViewStateSnapshot } from '../../mapLibreAdapter';
import { mapLibreSnapshotToViewportChange } from '../../mapLibreAdapter';
import {
  partitionMapLibreDiscoveryPoints,
  type MapLibrePersonPoint,
} from './mapLibrePersonPins';

type GeoJSONSourcePressHandler = NonNullable<React.ComponentProps<typeof GeoJSONSource>['onPress']>;
type MapLongPressHandler = NonNullable<React.ComponentProps<typeof Map>['onLongPress']>;
type MapStyle = React.ComponentProps<typeof Map>['mapStyle'];
type CircleLayerSpecification = Extract<LayerSpecification, { type: 'circle' }>;
type CircleLayerFilter = NonNullable<CircleLayerSpecification['filter']>;
type CircleLayerPaint = NonNullable<CircleLayerSpecification['paint']>;
type CircleOpacity = NonNullable<CircleLayerPaint['circle-opacity']>;
type CircleColor = NonNullable<CircleLayerPaint['circle-color']>;
type CircleRadius = NonNullable<CircleLayerPaint['circle-radius']>;
type CameraRef = React.ElementRef<typeof Camera>;

interface PersonAvatarState {
  source: string | null;
  uri: string | null;
}

interface MapLibrePersonMarkerProps {
  point: MapLibrePersonPoint;
  density: NexaMapZoomPolicy['markerDensity'];
  showCaption: boolean;
  selected: boolean;
  dimmed: boolean;
  reduceMotion: boolean;
  onPress: () => void;
}

const DISCOVERY_SOURCE_ID = 'nexa-discovery';
const DISCOVERY_LAYER_ID = 'nexa-discovery-points';
const DISCOVERY_SAVED_PLACE_HALO_LAYER_ID = 'nexa-discovery-saved-place-halo';
const DISCOVERY_SELECTED_HALO_LAYER_ID = 'nexa-discovery-selected-halo';
const DISCOVERY_SELECTED_LAYER_ID = 'nexa-discovery-selected';
const SELECTION_TRANSITION = { duration: 180, delay: 0 } as const;
const DISCOVERY_KIND_COLOR: CircleColor = [
  'match',
  ['get', 'kind'],
  'cluster', '#7C3AED',
  'event', '#F59E0B',
  'listing', '#22C55E',
  'place', '#27D3F2',
  '#8B5CF6',
];
const DISCOVERY_MARKER_RADIUS: CircleRadius = [
  'interpolate',
  ['linear'],
  ['zoom'],
  9,
  ['match', ['get', 'kind'], 'cluster', 10, 'event', 5, 'listing', 5, 'place', 5.5, 4.5],
  13,
  ['match', ['get', 'kind'], 'cluster', 13, 'event', 8, 'listing', 8, 'place', 8.5, 7],
  17,
  ['match', ['get', 'kind'], 'cluster', 16, 'event', 10, 'listing', 10, 'place', 10.5, 9],
];
const DISCOVERY_SAVED_PLACE_HALO_RADIUS: CircleRadius = [
  'interpolate', ['linear'], ['zoom'], 9, 9.5, 13, 13.5, 17, 16,
];
const DISCOVERY_SELECTED_RADIUS: CircleRadius = [
  'interpolate', ['linear'], ['zoom'], 9, 8, 13, 11, 17, 13,
];
const DISCOVERY_SELECTED_HALO_RADIUS: CircleRadius = [
  'interpolate', ['linear'], ['zoom'], 9, 13, 13, 18, 17, 21,
];

export interface MapLibreMapSurfaceProps {
  mapStyle: MapStyle;
  points: readonly MapDiscoveryPoint[];
  selectedKey: MapDiscoveryPointKey | null;
  dimUnselected: boolean;
  onReady: () => void;
  onPointPress: (key: MapDiscoveryPointKey) => void;
  onViewportSettled: (change: NexaMapViewportChange) => void;
  onLongPress: (coordinate: MapCoordinate) => void;
}

function isMapDiscoveryPointKey(value: unknown): value is MapDiscoveryPointKey {
  return typeof value === 'string' && /^(cluster|user|event|listing|place):.+$/.test(value);
}

function MapLibrePersonMarker({
  point,
  density,
  showCaption,
  selected,
  dimmed,
  reduceMotion,
  onPress,
}: MapLibrePersonMarkerProps): React.JSX.Element {
  const candidateAvatarUrl = resolvePersonMarkerAvatarUrl(point, density, selected);
  const [avatarState, setAvatarState] = React.useState<PersonAvatarState>(() => ({
    source: candidateAvatarUrl,
    uri: candidateAvatarUrl,
  }));
  const personAvatarUri = avatarState.source === candidateAvatarUrl
    ? avatarState.uri
    : candidateAvatarUrl;

  React.useEffect(() => {
    let active = true;
    if (candidateAvatarUrl == null) return () => { active = false; };

    void resolveAvatarUri(candidateAvatarUrl)
      .then((resolvedUri) => {
        if (!active || resolvedUri == null) return;
        setAvatarState({ source: candidateAvatarUrl, uri: resolvedUri });
      })
      .catch(() => undefined);

    return () => { active = false; };
  }, [candidateAvatarUrl]);

  const handleAvatarRenderError = React.useCallback((): void => {
    setAvatarState({ source: candidateAvatarUrl, uri: null });
  }, [candidateAvatarUrl]);

  return (
    <Marker
      id={getMapEntityKey(point)}
      lngLat={[point.lng, point.lat]}
      anchor="bottom"
      onPress={onPress}
    >
      <EntityMarker
        point={point}
        density={density}
        showCaption={showCaption}
        selected={selected}
        dimmed={dimmed}
        reduceMotion={reduceMotion}
        personAvatarUri={personAvatarUri}
        onPersonAvatarRenderError={handleAvatarRenderError}
      />
    </Marker>
  );
}

export const MapLibreMapSurface = React.forwardRef<NexaMapController, MapLibreMapSurfaceProps>(
  function MapLibreMapSurface(
    {
      mapStyle,
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
    const reduceMotion = useNexaReducedMotion();
    const [zoom, setZoom] = React.useState(12);
    const zoomPolicy = React.useMemo(
      () => resolveNexaMapZoomPolicy(Math.floor(zoom)),
      [zoom],
    );
    const { personPoints, layerPoints } = React.useMemo(
      () => partitionMapLibreDiscoveryPoints(points),
      [points],
    );
    const visiblePersonPoints = React.useMemo(
      () => limitVisibleMapPoints(personPoints, zoomPolicy.maxVisiblePoints, {
        selectedEntityKey: selectedKey,
      }).filter((point): point is MapLibrePersonPoint => point.kind === 'user'),
      [personPoints, selectedKey, zoomPolicy.maxVisiblePoints],
    );
    const data = React.useMemo(
      () => discoveryToMapFeatureCollection(layerPoints),
      [layerPoints],
    );

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
      setZoom(viewState.zoom);
      onViewportSettled(mapLibreSnapshotToViewportChange(viewStateSnapshot, boundsSnapshot));
    }, [onViewportSettled]);

    const handlePress = React.useCallback<GeoJSONSourcePressHandler>((event): void => {
      const key = event.nativeEvent.features?.[0]?.id;
      if (isMapDiscoveryPointKey(key)) onPointPress(key);
    }, [onPointPress]);

    const handleLongPress = React.useCallback<MapLongPressHandler>((event): void => {
      const [longitude, latitude] = event.nativeEvent.lngLat;
      onLongPress({ latitude, longitude });
    }, [onLongPress]);

    const selectedFilter = React.useMemo<CircleLayerFilter>(
      () => ['==', ['id'], selectedKey ?? '__nexa-no-selection__'],
      [selectedKey],
    );
    const savedPlaceFilter = React.useMemo<CircleLayerFilter>(
      () => [
        'all',
        ['==', ['get', 'kind'], 'place'],
        ['==', ['get', 'saved'], true],
        ['!=', ['id'], selectedKey ?? '__nexa-no-selection__'],
      ],
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
        mapStyle={mapStyle}
        style={StyleSheet.absoluteFill}
        attribution
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
            id={DISCOVERY_SAVED_PLACE_HALO_LAYER_ID}
            type="circle"
            filter={savedPlaceFilter}
            paint={{
              'circle-color': '#27D3F2',
              'circle-opacity': 0.12,
              'circle-radius': DISCOVERY_SAVED_PLACE_HALO_RADIUS,
              'circle-stroke-color': '#27D3F2',
              'circle-stroke-opacity': 0.88,
              'circle-stroke-width': 2.5,
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

        {visiblePersonPoints.map((point) => {
          const key = getMapEntityKey(point);
          const selected = key === selectedKey;
          const showCaption = zoomPolicy.captionMode === 'all'
            || (zoomPolicy.captionMode === 'selected' && selected);

          return (
            <MapLibrePersonMarker
              key={key}
              point={point}
              density={zoomPolicy.markerDensity}
              showCaption={showCaption}
              selected={selected}
              dimmed={dimUnselected && selectedKey !== null && !selected}
              reduceMotion={reduceMotion}
              onPress={() => onPointPress(key)}
            />
          );
        })}
      </Map>
    );
  },
);
