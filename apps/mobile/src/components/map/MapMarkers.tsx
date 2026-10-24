import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Marker } from 'react-native-maps';
import type { ClusterPoint, DiscoveryPoint, EntityPoint } from '@g88/shared';

import { nexaHaptics } from '@/haptics/nexaHaptics';
import { useAppSelector } from '@/hooks/redux';
import { useNexaReducedMotion } from '@/motion/useNexaReducedMotion';
import { useAppTheme } from '@/theme';

import { ClusterMarker } from './ClusterMarker';
import { EntityMarker } from './EntityMarker';
import { NEXA_MARKER_ANCHOR_Y } from './NexaEntityMarker';
import {
  limitVisibleMapPoints,
  resolveNexaMapZoomPolicy,
  type NexaMapZoomBand,
  type NexaMapZoomPolicy,
} from './nexaMapZoomDensity';
import {
  NEXA_INITIAL_MARKER_REVEAL_COUNT,
  NEXA_MARKER_REVEAL_INTERVAL_MS,
  nextNexaMarkerRevealCount,
  resolveNexaMarkerRevealCountForBand,
  shouldResetNexaRevealForReplacement,
} from './nexaProgressiveReveal';
import { clusterVisualKey, entityVisualKey } from './markerVisualKeys';
import { useTracksViewChanges } from './useTracksViewChanges';

interface MapMarkersProps {
  points: DiscoveryPoint[];
  /** Optional override for previews/tests. Runtime normally follows discovery.zoom. */
  zoomPolicy?: NexaMapZoomPolicy;
  /** Optional controlled entity selection. When omitted, the last tapped entity is tracked locally. */
  selectedEntityKey?: string | null;
  /** Optional controlled cluster selection. When omitted, the last tapped cluster is tracked locally. */
  selectedClusterCellId?: string | null;
  /** Optional semantic state inputs for map orchestration without changing marker internals. */
  newEntityKeys?: ReadonlySet<string>;
  ownEntityKey?: string | null;
  unavailableEntityKeys?: ReadonlySet<string>;
  dimUnselected?: boolean;
  onClusterPress: (p: ClusterPoint) => void;
  onEntityPress: (p: EntityPoint) => void;
}

interface RevealState {
  band: NexaMapZoomBand;
  count: number;
  pointKeys: readonly string[];
}

function entityKey(point: EntityPoint): string {
  return `${point.kind}:${point.id}`;
}

function discoveryPointRevealKey(point: DiscoveryPoint): string {
  return point.kind === 'cluster'
    ? `cluster:${point.cellId}`
    : entityKey(point);
}

/**
 * Isolated marker layer so MapScreen chrome state (sheet, FAB, loading)
 * does not re-reconcile every Marker when points/handlers are unchanged.
 */
function MapMarkersImpl({
  points,
  zoomPolicy,
  selectedEntityKey,
  selectedClusterCellId,
  newEntityKeys,
  ownEntityKey = null,
  unavailableEntityKeys,
  dimUnselected = false,
  onClusterPress,
  onEntityPress,
}: MapMarkersProps): React.JSX.Element {
  const committedDiscoveryZoom = useAppSelector((state) => state.discovery.zoom);
  const reduceMotion = useNexaReducedMotion();
  const { scheme, mode } = useAppTheme();
  const markerThemeKey = mode === 'protos-nexus' ? mode : scheme;
  const effectiveZoomPolicy =
    zoomPolicy ?? resolveNexaMapZoomPolicy(committedDiscoveryZoom);
  const pointKeys = useMemo(
    () => points.map(discoveryPointRevealKey),
    [points],
  );

  const [localSelectedEntityKey, setLocalSelectedEntityKey] = useState<string | null>(null);
  const [localSelectedClusterCellId, setLocalSelectedClusterCellId] = useState<string | null>(null);
  const [revealState, setRevealState] = useState<RevealState>(() => ({
    band: effectiveZoomPolicy.band,
    count: NEXA_INITIAL_MARKER_REVEAL_COUNT,
    pointKeys,
  }));
  const replacementReset = shouldResetNexaRevealForReplacement(
    revealState.pointKeys,
    pointKeys,
  );
  const bandRevealCount = resolveNexaMarkerRevealCountForBand(
    revealState.band,
    effectiveZoomPolicy.band,
    revealState.count,
  );
  const revealCount = replacementReset
    ? NEXA_INITIAL_MARKER_REVEAL_COUNT
    : bandRevealCount;

  const effectiveSelectedEntityKey =
    selectedEntityKey === undefined ? localSelectedEntityKey : selectedEntityKey;
  const effectiveSelectedClusterCellId =
    selectedClusterCellId === undefined
      ? localSelectedClusterCellId
      : selectedClusterCellId;

  useEffect(() => {
    if (selectedEntityKey !== undefined || localSelectedEntityKey == null) return;
    const stillVisible = points.some(
      (point) => point.kind !== 'cluster' && entityKey(point) === localSelectedEntityKey,
    );
    if (!stillVisible) {
      void Promise.resolve().then(() => setLocalSelectedEntityKey(null));
    }
  }, [localSelectedEntityKey, points, selectedEntityKey]);

  useEffect(() => {
    if (
      selectedClusterCellId !== undefined ||
      localSelectedClusterCellId == null
    ) {
      return;
    }
    const stillVisible = points.some(
      (point) =>
        point.kind === 'cluster' &&
        point.cellId === localSelectedClusterCellId,
    );
    if (!stillVisible) {
      void Promise.resolve().then(() => setLocalSelectedClusterCellId(null));
    }
  }, [localSelectedClusterCellId, points, selectedClusterCellId]);

  const visiblePoints = useMemo(
    () =>
      limitVisibleMapPoints(points, effectiveZoomPolicy.maxVisiblePoints, {
        selectedEntityKey: effectiveSelectedEntityKey,
        selectedClusterCellId: effectiveSelectedClusterCellId,
        ownEntityKey,
      }),
    [
      points,
      effectiveZoomPolicy.maxVisiblePoints,
      effectiveSelectedEntityKey,
      effectiveSelectedClusterCellId,
      ownEntityKey,
    ],
  );

  useEffect(() => {
    const bandChanged = revealState.band !== effectiveZoomPolicy.band;
    const identitiesChanged = revealState.pointKeys !== pointKeys;
    if (!bandChanged && !identitiesChanged) return;

    const nextBand = effectiveZoomPolicy.band;
    void Promise.resolve().then(() => {
      setRevealState((current) => {
        const shouldReset =
          current.band !== nextBand ||
          shouldResetNexaRevealForReplacement(current.pointKeys, pointKeys);
        return {
          band: nextBand,
          count: shouldReset
            ? NEXA_INITIAL_MARKER_REVEAL_COUNT
            : current.count,
          pointKeys,
        };
      });
    });
  }, [effectiveZoomPolicy.band, pointKeys, revealState.band, revealState.pointKeys]);

  useEffect(() => {
    if (reduceMotion || visiblePoints.length <= revealCount) return;
    const activeBand = effectiveZoomPolicy.band;
    const timer = setTimeout(() => {
      setRevealState((current) => {
        const shouldReset =
          current.band !== activeBand ||
          shouldResetNexaRevealForReplacement(current.pointKeys, pointKeys);
        const currentCount = shouldReset
          ? NEXA_INITIAL_MARKER_REVEAL_COUNT
          : resolveNexaMarkerRevealCountForBand(
              current.band,
              activeBand,
              current.count,
            );
        return {
          band: activeBand,
          count: nextNexaMarkerRevealCount(
            currentCount,
            visiblePoints.length,
            false,
          ),
          pointKeys,
        };
      });
    }, NEXA_MARKER_REVEAL_INTERVAL_MS);
    return () => clearTimeout(timer);
  }, [
    effectiveZoomPolicy.band,
    pointKeys,
    reduceMotion,
    revealCount,
    visiblePoints.length,
  ]);

  const revealedPoints = useMemo(() => {
    if (reduceMotion || visiblePoints.length <= revealCount) return visiblePoints;
    return limitVisibleMapPoints(visiblePoints, revealCount, {
      selectedEntityKey: effectiveSelectedEntityKey,
      selectedClusterCellId: effectiveSelectedClusterCellId,
      ownEntityKey,
    });
  }, [
    effectiveSelectedClusterCellId,
    effectiveSelectedEntityKey,
    ownEntityKey,
    reduceMotion,
    revealCount,
    visiblePoints,
  ]);

  const handleEntityPress = useCallback(
    (point: EntityPoint) => {
      nexaHaptics.select();
      if (selectedEntityKey === undefined) {
        setLocalSelectedEntityKey(entityKey(point));
      }
      if (selectedClusterCellId === undefined) {
        setLocalSelectedClusterCellId(null);
      }
      onEntityPress(point);
    }, [onEntityPress, selectedClusterCellId, selectedEntityKey],
  );

  const handleClusterPress = useCallback(
    (point: ClusterPoint) => {
      nexaHaptics.discover();
      if (selectedClusterCellId === undefined) {
        setLocalSelectedClusterCellId(point.cellId);
      }
      if (selectedEntityKey === undefined) {
        setLocalSelectedEntityKey(null);
      }
      onClusterPress(point);
    }, [onClusterPress, selectedClusterCellId, selectedEntityKey],
  );

  return (
    <>
      {revealedPoints.map((point) => {
        if (point.kind === 'cluster') {
          return (
            <ClusterMarkerItem
              key={`c:${point.cellId}`}
              point={point}
              selected={point.cellId === effectiveSelectedClusterCellId}
              showComposition={effectiveZoomPolicy.showClusterComposition}
              reduceMotion={reduceMotion}
              themeVisualKey={markerThemeKey}
              onPress={handleClusterPress}
            />
          );
        }

        const key = entityKey(point);
        const selected = key === effectiveSelectedEntityKey;
        const showCaption =
          effectiveZoomPolicy.captionMode === 'all' ||
          (effectiveZoomPolicy.captionMode === 'selected' && selected);

        return (
          <EntityMarkerItem
            key={`e:${key}`}
            point={point}
            density={effectiveZoomPolicy.markerDensity}
            showCaption={showCaption}
            selected={selected}
            isNew={newEntityKeys?.has(key) === true}
            own={key === ownEntityKey}
            unavailable={unavailableEntityKeys?.has(key) === true}
            dimmed={
              dimUnselected &&
              effectiveSelectedEntityKey != null &&
              !selected
            }
            reduceMotion={reduceMotion}
            themeVisualKey={markerThemeKey}
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
    prev.zoomPolicy === next.zoomPolicy &&
    prev.selectedEntityKey === next.selectedEntityKey &&
    prev.selectedClusterCellId === next.selectedClusterCellId &&
    prev.newEntityKeys === next.newEntityKeys &&
    prev.ownEntityKey === next.ownEntityKey &&
    prev.unavailableEntityKeys === next.unavailableEntityKeys &&
    prev.dimUnselected === next.dimUnselected &&
    prev.onClusterPress === next.onClusterPress &&
    prev.onEntityPress === next.onEntityPress
  );
}

export const MapMarkers = React.memo(MapMarkersImpl, mapMarkersPropsEqual);

interface ClusterItemProps {
  point: ClusterPoint;
  selected: boolean;
  showComposition: boolean;
  reduceMotion: boolean;
  themeVisualKey: string;
  onPress: (p: ClusterPoint) => void;
}

function ClusterMarkerItemImpl({
  point,
  selected,
  showComposition,
  reduceMotion,
  themeVisualKey,
  onPress,
}: ClusterItemProps): React.JSX.Element {
  const renderKey = [
    clusterVisualKey(point),
    selected ? 'selected' : 'default',
    showComposition ? 'composition' : 'minimal',
    themeVisualKey,
  ].join('|');
  const tracksViewChanges = useTracksViewChanges([renderKey]);
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
      zIndex={selected ? 35 : 5}
    >
      <ClusterMarker
        point={point}
        selected={selected}
        showComposition={showComposition}
        reduceMotion={reduceMotion}
      />
    </Marker>
  );
}

function clusterItemPropsEqual(prev: ClusterItemProps, next: ClusterItemProps): boolean {
  return (
    prev.onPress === next.onPress &&
    prev.selected === next.selected &&
    prev.showComposition === next.showComposition &&
    prev.reduceMotion === next.reduceMotion &&
    prev.themeVisualKey === next.themeVisualKey &&
    clusterVisualKey(prev.point) === clusterVisualKey(next.point) &&
    prev.point.lat === next.point.lat &&
    prev.point.lng === next.point.lng
  );
}

const ClusterMarkerItem = React.memo(ClusterMarkerItemImpl, clusterItemPropsEqual);

interface EntityItemProps {
  point: EntityPoint;
  density: NexaMapZoomPolicy['markerDensity'];
  showCaption: boolean;
  selected: boolean;
  isNew: boolean;
  own: boolean;
  dimmed: boolean;
  unavailable: boolean;
  reduceMotion: boolean;
  themeVisualKey: string;
  onPress: (p: EntityPoint) => void;
}

function EntityMarkerItemImpl({
  point,
  density,
  showCaption,
  selected,
  isNew,
  own,
  dimmed,
  unavailable,
  reduceMotion,
  themeVisualKey,
  onPress,
}: EntityItemProps): React.JSX.Element {
  const baseVisualKey = entityVisualKey(point);
  const renderKey = [
    baseVisualKey,
    density,
    showCaption ? 'caption' : 'no-caption',
    selected ? 'selected' : 'default',
    isNew ? 'new' : 'seen',
    own ? 'own' : 'other',
    dimmed ? 'dim' : 'normal',
    unavailable ? 'unavailable' : 'available',
    themeVisualKey,
  ].join('|');
  const tracksViewChanges = useTracksViewChanges([renderKey]);
  const coordinate = useMemo(
    () => ({ latitude: point.lat, longitude: point.lng }),
    [point.lat, point.lng],
  );
  const isLive = point.kind === 'user' && point.meta.online === true;

  // Do NOT call e.stopPropagation() — on Android Google Maps MarkerPress can native-crash.
  const handlePress = useCallback(() => {
    onPress(point);
  }, [onPress, point]);

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
        density={density}
        showCaption={showCaption}
        selected={selected}
        isNew={isNew}
        own={own}
        dimmed={dimmed}
        unavailable={unavailable}
        reduceMotion={reduceMotion}
      />
    </Marker>
  );
}

function entityItemPropsEqual(prev: EntityItemProps, next: EntityItemProps): boolean {
  return (
    prev.onPress === next.onPress &&
    prev.density === next.density &&
    prev.showCaption === next.showCaption &&
    prev.selected === next.selected &&
    prev.isNew === next.isNew &&
    prev.own === next.own &&
    prev.dimmed === next.dimmed &&
    prev.unavailable === next.unavailable &&
    prev.reduceMotion === next.reduceMotion &&
    prev.themeVisualKey === next.themeVisualKey &&
    entityVisualKey(prev.point) === entityVisualKey(next.point) &&
    prev.point.lat === next.point.lat &&
    prev.point.lng === next.point.lng
  );
}

const EntityMarkerItem = React.memo(EntityMarkerItemImpl, entityItemPropsEqual);
