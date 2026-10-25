import React from 'react';
import type { ClusterPoint, DiscoveryPoint, EntityPoint } from '@g88/shared';

import { MapMarkers } from '@/components/map/MapMarkers';

export interface LegacyDiscoveryLayerProps {
  points: DiscoveryPoint[];
  selectedEntityKey?: string | null;
  selectedClusterCellId?: string | null;
  newEntityKeys?: ReadonlySet<string>;
  ownEntityKey?: string | null;
  unavailableEntityKeys?: ReadonlySet<string>;
  dimUnselected?: boolean;
  onClusterPress: (point: ClusterPoint) => void;
  onEntityPress: (point: EntityPoint) => void;
}

/**
 * Compatibility boundary for the existing react-native-maps marker renderer.
 *
 * MapScreen should depend on a NEXA map surface rather than MapMarkers directly.
 * Keeping this adapter deliberately thin gives the MapLibre implementation a
 * parallel seam without changing discovery, privacy, or interaction semantics.
 */
export const LegacyDiscoveryLayer = React.memo(function LegacyDiscoveryLayer({
  points,
  selectedEntityKey,
  selectedClusterCellId,
  newEntityKeys,
  ownEntityKey = null,
  unavailableEntityKeys,
  dimUnselected = false,
  onClusterPress,
  onEntityPress,
}: LegacyDiscoveryLayerProps): React.JSX.Element {
  return (
    <MapMarkers
      points={points}
      selectedEntityKey={selectedEntityKey}
      selectedClusterCellId={selectedClusterCellId}
      newEntityKeys={newEntityKeys}
      ownEntityKey={ownEntityKey}
      unavailableEntityKeys={unavailableEntityKeys}
      dimUnselected={dimUnselected}
      onClusterPress={onClusterPress}
      onEntityPress={onEntityPress}
    />
  );
});
