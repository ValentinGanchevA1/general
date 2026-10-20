import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Marker } from 'react-native-maps';
import type { ClusterPoint, DiscoveryPoint, EntityPoint } from '@g88/shared';

import { ClusterMarker } from './ClusterMarker';
import { EntityMarker } from './EntityMarker';
import { NEXA_MARKER_ANCHOR_Y } from './NexaEntityMarker';
import { clusterVisualKey, entityVisualKey } from './markerVisualKeys';
import { useTracksViewChanges } from './useTracksViewChanges';

interface MapMarkersProps {
  points: DiscoveryPoint[];
  /** Optional controlled selection. When omitted, MapMarkers tracks the last tapped entity. */
  selectedEntityKey?: string | null;
  /** Optional semantic state inputs for map orchestration without changing marker internals. */
  newEntityKeys?: ReadonlySet<string>;
  ownEntityKey?: string | null;
  unavailableEntityKeys?: ReadonlySet<string>;
  dimUnselected?: boolean;
  onClusterPress: (p: ClusterPoint) => void;
  onEntityPress: (p: EntityPoint) => void;
}

function entityKey(point: EntityPoint): string {
  return `${point.kind}:${point.id}`;
}

/**
 * Isolated marker layer so MapScreen chrome state (sheet, FAB, loading)
 * does not re-reconcile every Marker when points/handlers are unchanged.
 */
function MapMarkersImpl({
  points,
  selectedEntityKey,
  newEntityKeys,
  ownEntityKey = null,
  unavailableEntityKeys,
  dimUnselected = false,
  onClusterPress,
  onEntityPress,
}: MapMarkersProps): React.JSX.Element {
  const [localSelectedEntityKey, setLocalSelectedEntityKey] = useState<string | null>(null);
  const effectiveSelectedKey =
    selectedEntityKey === undefined ? localSelectedEntityKey : selectedEntityKey;

  useEffect(() => {
    if (selectedEntityKey !== undefined || localSelectedEntityKey == null) return;
    const stillVisible = points.some(
      (point) => point.kind !== 'cluster' && entityKey(point) === localSelectedEntityKey,
    );
    if (!stillVisible) {
      void Promise.resolve().then(() => setLocalSelectedEntityKey(null));
    }
  }, [localSelectedEntityKey, points, selectedEntityKey]);

  const handleEntityPress = useCallback(
    (point: EntityPoint) => {
      if (selectedEntityKey === undefined) {
        setLocalSelectedEntityKey(entityKey(point));
      }
      onEntityPress(point);
    },
    [onEntityPress, selectedEntityKey],
  );

  const handleClusterPress = useCallback(
    (point: ClusterPoint) => {
      if (selectedEntityKey === undefined) {
        setLocalSelectedEntityKey(null);
      }
      onClusterPress(point);
    },
    [onClusterPress, selectedEntityKey],
  );

  return (
    <>
      {points.map((point) => {
        if (point.kind === 'cluster') {
          return (
            <ClusterMarkerItem
              key={`c:${point.cellId}`}
              point={point}
              onPress={handleClusterPress}
            />
          );
        }

        const key = entityKey(point);
        const selected = key === effectiveSelectedKey;

        return (
          <EntityMarkerItem
            key={`e:${key}`}
            point={point}
            selected={selected}
            isNew={newEntityKeys?.has(key) === true}
            own={key === ownEntityKey}
            unavailable={unavailableEntityKeys?.has(key) === true}
            dimmed={dimUnselected && effectiveSelectedKey != null && !selected}
            onPress={handleEntityPress}
          />
        );
      })}
    </>
  );
}

function mapMarkersPropsEqual(prev: MapMarkersProps, next: MapMarkersProps): boolean {
  return (
    prev.points === next.points &&
    prev.selectedEntityKey === next.selectedEntityKey &&
    prev.newEntityKeys === next.newEntityKeys &&
    prev.ownEntityKey === next.ownEntityKey &&
    prev.unavailableEntityKeys === next.unavailableEntityKeys &&
    prev.dimUnselected === next.dimUnselected &&
    prev.onClusterPress === next.onClusterPress &&
    prev.onEntityPress === next.onEntityPress
  );
}

export const MapMarkers = React.memo(MapMarkersImpl, mapMarkersPropsEqual);

// ─── Per-marker wrappers ─────────────────────────────────────────────────

interface ClusterItemProps {
  point: ClusterPoint;
  onPress: (p: ClusterPoint) => void;
}

function ClusterMarkerItemImpl({ point, onPress }: ClusterItemProps): React.JSX.Element {
  const tracksViewChanges = useTracksViewChanges([clusterVisualKey(point)]);
  const coordinate = useMemo(
    () => ({ latitude: point.lat, longitude: point.lng }),
    [point.lat, point.lng],
  );

  // Do NOT call e.stopPropagation() — on Android Google Maps that can native-crash.
  const handlePress = useCallback(() => {
    onPress(point);
  }, [onPress, point]);

  return (
    <Marker
      coordinate={coordinate}
      onPress={handlePress}
      tracksViewChanges={tracksViewChanges}
      anchor={{ x: 0.5, y: 0.5 }}
      zIndex={5}
    >
      <ClusterMarker point={point} />
    </Marker>
  );
}

function clusterItemPropsEqual(prev: ClusterItemProps, next: ClusterItemProps): boolean {
  return (
    prev.onPress === next.onPress &&
    clusterVisualKey(prev.point) === clusterVisualKey(next.point) &&
    prev.point.lat === next.point.lat &&
    prev.point.lng === next.point.lng
  );
}

const ClusterMarkerItem = React.memo(ClusterMarkerItemImpl, clusterItemPropsEqual);

interface EntityItemProps {
  point: EntityPoint;
  selected: boolean;
  isNew: boolean;
  own: boolean;
  dimmed: boolean;
  unavailable: boolean;
  onPress: (p: EntityPoint) => void;
}

function EntityMarkerItemImpl({
  point,
  selected,
  isNew,
  own,
  dimmed,
  unavailable,
  onPress,
}: EntityItemProps): React.JSX.Element {
  const [visualSettled, setVisualSettled] = useState(false);
  const baseVisualKey = entityVisualKey(point);
  const renderKey = [
    baseVisualKey,
    selected ? 'selected' : 'default',
    isNew ? 'new' : 'seen',
    own ? 'own' : 'other',
    dimmed ? 'dim' : 'normal',
    unavailable ? 'unavailable' : 'available',
  ].join('|');
  const tracksFromKey = useTracksViewChanges([renderKey]);

  // react-native-maps snapshots marker children. Re-open tracking whenever a
  // painted NEXA marker state changes, then freeze again after layout settles.
  useEffect(() => {
    void Promise.resolve().then(() => {
      setVisualSettled(false);
    });
  }, [renderKey]);

  const tracksViewChanges = tracksFromKey || !visualSettled;
  const coordinate = useMemo(
    () => ({ latitude: point.lat, longitude: point.lng }),
    [point.lat, point.lng],
  );
  const isLive = point.kind === 'user' && point.meta.online === true;

  // Do NOT call e.stopPropagation() — Android Google Maps MarkerPress can native-crash.
  const handlePress = useCallback(() => {
    onPress(point);
  }, [onPress, point]);
  const onVisualSettled = useCallback(() => setVisualSettled(true), []);

  return (
    <Marker
      coordinate={coordinate}
      onPress={handlePress}
      tracksViewChanges={tracksViewChanges}
      anchor={{ x: 0.5, y: NEXA_MARKER_ANCHOR_Y }}
      zIndex={selected ? 40 : own ? 30 : isLive ? 20 : isNew ? 15 : 10}
    >
      <EntityMarker
        point={point}
        selected={selected}
        isNew={isNew}
        own={own}
        dimmed={dimmed}
        unavailable={unavailable}
        onVisualSettled={onVisualSettled}
      />
    </Marker>
  );
}

function entityItemPropsEqual(prev: EntityItemProps, next: EntityItemProps): boolean {
  return (
    prev.onPress === next.onPress &&
    prev.selected === next.selected &&
    prev.isNew === next.isNew &&
    prev.own === next.own &&
    prev.dimmed === next.dimmed &&
    prev.unavailable === next.unavailable &&
    entityVisualKey(prev.point) === entityVisualKey(next.point) &&
    prev.point.lat === next.point.lat &&
    prev.point.lng === next.point.lng
  );
}

const EntityMarkerItem = React.memo(EntityMarkerItemImpl, entityItemPropsEqual);
