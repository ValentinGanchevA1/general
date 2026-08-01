import React, { useCallback, useMemo } from 'react';
import { Marker } from 'react-native-maps';
import type { ClusterPoint, DiscoveryPoint, EntityPoint } from '@g88/shared';

import { ClusterMarker } from './ClusterMarker';
import { EntityMarker } from './EntityMarker';
import { clusterVisualKey, entityVisualKey } from './markerVisualKeys';
import { useTracksViewChanges } from './useTracksViewChanges';

interface MapMarkersProps {
  points: DiscoveryPoint[];
  onClusterPress: (p: ClusterPoint) => void;
  onEntityPress: (p: EntityPoint) => void;
}

/**
 * Isolated marker layer so MapScreen chrome state (sheet, FAB, loading)
 * does not re-reconcile every Marker when points/handlers are unchanged.
 */
function MapMarkersImpl({
  points,
  onClusterPress,
  onEntityPress,
}: MapMarkersProps): React.JSX.Element {
  return (
    <>
      {points.map((p) =>
        p.kind === 'cluster' ? (
          <ClusterMarkerItem
            key={`c:${p.cellId}`}
            point={p}
            onPress={onClusterPress}
          />
        ) : (
          <EntityMarkerItem
            key={`e:${p.kind}:${p.id}`}
            point={p}
            onPress={onEntityPress}
          />
        ),
      )}
    </>
  );
}

function mapMarkersPropsEqual(prev: MapMarkersProps, next: MapMarkersProps): boolean {
  return (
    prev.points === next.points &&
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
  const handlePress = useCallback(() => onPress(point), [onPress, point]);

  return (
    <Marker
      coordinate={coordinate}
      onPress={handlePress}
      tracksViewChanges={tracksViewChanges}
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
  onPress: (p: EntityPoint) => void;
}

function EntityMarkerItemImpl({ point, onPress }: EntityItemProps): React.JSX.Element {
  const tracksViewChanges = useTracksViewChanges([entityVisualKey(point)]);
  const coordinate = useMemo(
    () => ({ latitude: point.lat, longitude: point.lng }),
    [point.lat, point.lng],
  );
  const handlePress = useCallback(() => onPress(point), [onPress, point]);

  return (
    <Marker
      coordinate={coordinate}
      onPress={handlePress}
      tracksViewChanges={tracksViewChanges}
    >
      <EntityMarker point={point} />
    </Marker>
  );
}

function entityItemPropsEqual(prev: EntityItemProps, next: EntityItemProps): boolean {
  return (
    prev.onPress === next.onPress &&
    entityVisualKey(prev.point) === entityVisualKey(next.point) &&
    prev.point.lat === next.point.lat &&
    prev.point.lng === next.point.lng
  );
}

const EntityMarkerItem = React.memo(EntityMarkerItemImpl, entityItemPropsEqual);
