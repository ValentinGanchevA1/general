import React from 'react';
import type { MapClusterPoint, MapDiscoveryPoint, MapEntityPoint } from '@g88/shared';

import { MapMarkers } from '@/components/map/MapMarkers';

const EMPTY_ENTITY_KEYS: ReadonlySet<string> = new Set<string>();

export interface LegacyDiscoveryLayerProps {
  points: MapDiscoveryPoint[];
  selectedEntityKey?: string | null;
  selectedClusterCellId?: string | null;
  newEntityKeys?: ReadonlySet<string>;
  ownEntityKey?: string | null;
  unavailableEntityKeys?: ReadonlySet<string>;
  dimUnselected?: boolean;
  onClusterPress: (point: MapClusterPoint) => void;
  onEntityPress: (point: MapEntityPoint) => void;
}

export const LegacyDiscoveryLayer = React.memo(function LegacyDiscoveryLayer({
  points,
  selectedEntityKey = null,
  selectedClusterCellId = null,
  newEntityKeys = EMPTY_ENTITY_KEYS,
  ownEntityKey = null,
  unavailableEntityKeys = EMPTY_ENTITY_KEYS,
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
