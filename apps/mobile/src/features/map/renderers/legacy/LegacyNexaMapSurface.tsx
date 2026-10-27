import React from 'react';
import { StyleSheet } from 'react-native';
import MapView, { PROVIDER_GOOGLE } from 'react-native-maps';

import {
  LegacyDiscoveryLayer,
  type LegacyDiscoveryLayerProps,
} from '@/features/map/renderers/legacy/LegacyDiscoveryLayer';

type NativeMapProps = React.ComponentProps<typeof MapView>;

export interface LegacyNexaMapSurfaceProps extends LegacyDiscoveryLayerProps {
  mapRef: React.Ref<MapView>;
  customMapStyle: NonNullable<NativeMapProps['customMapStyle']>;
  onMapReady: NonNullable<NativeMapProps['onMapReady']>;
  onRegionChangeComplete: NonNullable<NativeMapProps['onRegionChangeComplete']>;
  onLongPress: NonNullable<NativeMapProps['onLongPress']>;
}

/**
 * Production-safe legacy NEXA map surface.
 *
 * This component intentionally preserves the current react-native-maps behavior
 * while moving renderer ownership out of MapScreen. Camera control remains on
 * the existing MapView ref for this compatibility step; the next migration step
 * replaces that ref with NexaMapController without changing discovery semantics.
 */
export const LegacyNexaMapSurface = React.memo(function LegacyNexaMapSurface({
  mapRef,
  customMapStyle,
  onMapReady,
  onRegionChangeComplete,
  onLongPress,
  ...discoveryLayerProps
}: LegacyNexaMapSurfaceProps): React.JSX.Element {
  return (
    <MapView
      ref={mapRef}
      provider={PROVIDER_GOOGLE}
      customMapStyle={customMapStyle}
      style={StyleSheet.absoluteFill}
      showsUserLocation
      showsMyLocationButton={false}
      showsCompass={false}
      toolbarEnabled={false}
      onMapReady={onMapReady}
      onRegionChangeComplete={onRegionChangeComplete}
      onLongPress={onLongPress}
    >
      <LegacyDiscoveryLayer {...discoveryLayerProps} />
    </MapView>
  );
});
