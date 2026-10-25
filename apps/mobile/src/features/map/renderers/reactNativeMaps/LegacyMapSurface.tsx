import React from 'react';
import { StyleSheet } from 'react-native';
import MapView, {
  PROVIDER_GOOGLE,
  type MapPressEvent,
  type Region,
} from 'react-native-maps';
import type { ClusterPoint, DiscoveryPoint, EntityPoint } from '@g88/shared';

import { resolveMapStyle } from '@/components/map/mapStyle';
import { LegacyDiscoveryLayer } from './LegacyDiscoveryLayer';

export interface LegacyMapSurfaceProps {
  points: DiscoveryPoint[];
  selectedEntityKey: string | null;
  dimUnselected: boolean;
  mode: Parameters<typeof resolveMapStyle>[0];
  scheme: Parameters<typeof resolveMapStyle>[1];
  onReady: () => void;
  onRegionChangeComplete: (region: Region) => void;
  onLongPress: (event: MapPressEvent) => void;
  onClusterPress: (point: ClusterPoint) => void;
  onEntityPress: (point: EntityPoint) => void;
}

/**
 * Runtime boundary for the current react-native-maps implementation.
 *
 * Product/domain state stays outside this component. Keeping the current map
 * SDK behind a dedicated surface lets MapScreen preserve its existing behavior
 * while a MapLibre surface is validated in parallel behind the rollout gate.
 */
export const LegacyMapSurface = React.forwardRef<MapView, LegacyMapSurfaceProps>(
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
    return (
      <MapView
        ref={ref}
        provider={PROVIDER_GOOGLE}
        customMapStyle={resolveMapStyle(mode, scheme)}
        style={StyleSheet.absoluteFill}
        showsUserLocation
        showsMyLocationButton={false}
        showsCompass={false}
        toolbarEnabled={false}
        onMapReady={onReady}
        onRegionChangeComplete={onRegionChangeComplete}
        onLongPress={onLongPress}
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
