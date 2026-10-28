import React from 'react';
import { StyleSheet } from 'react-native';
import MapView, {
  PROVIDER_GOOGLE,
  type LongPressEvent,
  type Region,
} from 'react-native-maps';
import type { MapClusterPoint, MapDiscoveryPoint, MapEntityPoint } from '@g88/shared';

import { resolveMapStyle } from '@/components/map/mapStyle';
import type { MapCoordinate, NexaMapController } from '../../contracts/mapRenderer';
import { LegacyDiscoveryLayer } from './LegacyDiscoveryLayer';

export interface LegacyMapSurfaceProps {
  points: MapDiscoveryPoint[];
  selectedEntityKey: string | null;
  dimUnselected: boolean;
  mode: Parameters<typeof resolveMapStyle>[0];
  scheme: Parameters<typeof resolveMapStyle>[1];
  onReady: () => void;
  onRegionChangeComplete: (region: Region) => void;
  onLongPress: (coordinate: MapCoordinate) => void;
  onClusterPress: (point: MapClusterPoint) => void;
  onEntityPress: (point: MapEntityPoint) => void;
}

export const LegacyMapSurface = React.forwardRef<NexaMapController, LegacyMapSurfaceProps>(
  function LegacyMapSurface(
    {
      points,
      selectedEntityKey,
      dimUnselected,
      mode,
      scheme,
      onReady,
      onRegionChangeComplete,
      onLongPress,
      onClusterPress,
      onEntityPress,
    },
    ref,
  ): React.JSX.Element {
    const mapRef = React.useRef<MapView>(null);

    React.useImperativeHandle(ref, () => ({
      flyTo(target, options) {
        const map = mapRef.current;
        if (map === null) return;
        map.animateCamera(
          {
            center: target.center,
            ...(target.zoom !== undefined ? { zoom: target.zoom } : {}),
            ...(target.bearing !== undefined ? { heading: target.bearing } : {}),
            ...(target.pitch !== undefined ? { pitch: target.pitch } : {}),
          },
          { duration: options?.durationMs ?? 0 },
        );
      },
      fitViewport(viewport, options) {
        const map = mapRef.current;
        if (map === null) return;
        const padding = options?.padding;
        map.fitToCoordinates(
          [
            { latitude: viewport.ne.lat, longitude: viewport.ne.lng },
            { latitude: viewport.sw.lat, longitude: viewport.sw.lng },
          ],
          {
            edgePadding: {
              top: padding?.top ?? 0,
              right: padding?.right ?? 0,
              bottom: padding?.bottom ?? 0,
              left: padding?.left ?? 0,
            },
            animated: (options?.durationMs ?? 0) > 0,
          },
        );
      },
    }), []);

    const handleLongPress = React.useCallback(
      (event: LongPressEvent): void => {
        const { latitude, longitude } = event.nativeEvent.coordinate;
        onLongPress({ latitude, longitude });
      },
      [onLongPress],
    );

    return (
      <MapView
        ref={mapRef}
        provider={PROVIDER_GOOGLE}
        customMapStyle={resolveMapStyle(mode, scheme)}
        style={StyleSheet.absoluteFill}
        showsUserLocation
        showsMyLocationButton={false}
        showsCompass={false}
        toolbarEnabled={false}
        onMapReady={onReady}
        onRegionChangeComplete={onRegionChangeComplete}
        onLongPress={handleLongPress}
      >
        <LegacyDiscoveryLayer
          points={points}
          selectedEntityKey={selectedEntityKey}
          dimUnselected={dimUnselected}
          onEntityPress={onEntityPress}
          onClusterPress={onClusterPress}
        />
      </MapView>
    );
  },
);
