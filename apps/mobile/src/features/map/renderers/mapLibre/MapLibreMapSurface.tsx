import React from 'react';
import { StyleSheet } from 'react-native';
import type { DiscoveryPoint } from '@g88/shared';
import {
  Camera,
  CircleLayer,
  Map,
  ShapeSource,
  type MapRef,
} from '@maplibre/maplibre-react-native';

import type { MapLibreBoundsSnapshot, MapLibreViewStateSnapshot } from '../../mapLibreAdapter';
import { mapLibreSnapshotToViewportChange } from '../../mapLibreAdapter';
import type { NexaMapViewportChange } from '../../contracts/mapRenderer';
import { getDiscoveryPointKey } from '../../discoveryPointKey';

const DEVELOPMENT_MAP_STYLE = 'https://demotiles.maplibre.org/style.json';
const DISCOVERY_SOURCE_ID = 'nexa-discovery';

interface DiscoveryFeatureProperties {
  key: string;
  kind: DiscoveryPoint['kind'];
  count: number;
}

type DiscoveryFeatureCollection = GeoJSON.FeatureCollection<
  GeoJSON.Point,
  DiscoveryFeatureProperties
>;

export interface MapLibreMapSurfaceProps {
  points: readonly DiscoveryPoint[];
  onReady: () => void;
  onViewportSettled: (change: NexaMapViewportChange) => void;
}

function toDiscoveryFeatureCollection(
  points: readonly DiscoveryPoint[],
): DiscoveryFeatureCollection {
  return {
    type: 'FeatureCollection',
    features: points.map((point) => ({
      type: 'Feature',
      id: getDiscoveryPointKey(point),
      geometry: {
        type: 'Point',
        coordinates: [point.coordinate.lng, point.coordinate.lat],
      },
      properties: {
        key: getDiscoveryPointKey(point),
        kind: point.kind,
        count: point.kind === 'cluster' ? point.count : 1,
      },
    })),
  };
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
    const shape = React.useMemo(() => toDiscoveryFeatureCollection(points), [points]);

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
        <ShapeSource id={DISCOVERY_SOURCE_ID} shape={shape}>
          <CircleLayer
            id="nexa-discovery-points"
            style={{
              circleColor: '#8B5CF6',
              circleOpacity: 0.9,
              circleRadius: ['case', ['==', ['get', 'kind'], 'cluster'], 12, 7],
              circleStrokeColor: '#FFFFFF',
              circleStrokeWidth: 1.5,
            }}
          />
        </ShapeSource>
      </Map>
    );
  },
);
