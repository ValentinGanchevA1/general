import React, {
  useCallback,
  useMemo,
  useRef,
  useState,
  useSyncExternalStore,
} from 'react';
import type { Region } from 'react-native-maps';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import {
  BottomSheetModal,
  BottomSheetView,
} from '@gorhom/bottom-sheet';
import type {
  ClusterPoint,
  DiscoveryPoint,
  EntityPoint,
  PlaceMapEntityPoint,
  Viewport,
} from '@g88/shared';

import { Config } from '@/config';
import { useAppSelector } from '@/hooks/redux';
import type { RootStackParamList } from '@/navigation/AppNavigator';
import { useSheetBackdrop, useSheetChrome } from '@/components/sheets';
import { PlaceMapPreviewSheet } from '@/features/places/PlaceMapPreviewSheet';
import { setPendingPlaceCheckIn } from '@/features/places/pendingPlaceCheckIn';
import { savedPlacesMapLayerStore } from '@/features/places/savedPlacesMapLayer.store';
import { usePlaceMapDiscovery } from '@/features/places/usePlaceMapDiscovery';
import { useSavedPlacesMapOverlay } from '@/features/places/useSavedPlacesMapOverlay';
import { mergeMapDiscoveryPoints } from '@/features/map/mergeMapDiscoveryPoints';
import type { NexaMapController } from '../contracts/mapRenderer';
import {
  NEXA_MAP_RENDERER_ROLLOUT,
  resolveRemoteMapRendererRequest,
} from '../mapRendererRollout';
import { useMapRendererPolicyLifecycle } from '../useMapRendererPolicyLifecycle';
import { resolveMapLibreStyleRuntime } from '../mapLibreStyleRuntime';
import {
  NexaMapRuntimeSurface,
  type NexaMapRuntimeSurfaceProps,
} from './NexaMapRuntimeSurface';

export type NexaMapScreenSurfaceProps = Omit<
  NexaMapRuntimeSurfaceProps,
  | 'requestedRenderer'
  | 'mapLibreAvailable'
  | 'mapLibreStyle'
  | 'points'
  | 'onEntityPress'
  | 'onClusterPress'
  | 'onRegionChangeComplete'
> & {
  points: DiscoveryPoint[];
  onEntityPress: (point: EntityPoint) => void;
  onClusterPress: (point: ClusterPoint) => void;
  onRegionChangeComplete: (region: Region) => void;
};

const MAPLIBRE_STYLE_RUNTIME = resolveMapLibreStyleRuntime({
  apiKey: Config.MAPTILER_API_KEY,
  mapId: Config.MAPTILER_MAP_ID,
  region: Config.MAPTILER_REGION,
});

const PLACE_PREVIEW_SNAP_POINTS = ['34%'] as const;

function regionToViewport(region: Region | null): Viewport | null {
  if (region == null) return null;
  const halfLat = region.latitudeDelta / 2;
  const halfLng = region.longitudeDelta / 2;
  return {
    sw: { lat: region.latitude - halfLat, lng: region.longitude - halfLng },
    ne: { lat: region.latitude + halfLat, lng: region.longitude + halfLng },
  };
}

function approxZoom(region: Region | null): number {
  if (region == null) return 12;
  const delta = Math.max(region.latitudeDelta, 0.0001);
  return Math.max(0, Math.min(20, Math.floor(Math.log2(360 / delta))));
}

/** Product-facing map surface used by MapScreen. */
export const NexaMapScreenSurface = React.forwardRef<
  NexaMapController,
  NexaMapScreenSurfaceProps
>(function NexaMapScreenSurface(
  {
    points,
    onEntityPress,
    onClusterPress,
    onRegionChangeComplete,
    selectedEntityKey,
    dimUnselected,
    ...props
  },
  ref,
): React.JSX.Element {
  useMapRendererPolicyLifecycle();

  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const sheetChrome = useSheetChrome();
  const renderBackdrop = useSheetBackdrop(0.35);
  const placeSheetRef = useRef<BottomSheetModal>(null);
  const [selectedPlace, setSelectedPlace] = useState<PlaceMapEntityPoint | null>(null);
  const [settledRegion, setSettledRegion] = useState<Region | null>(null);
  const viewport = useMemo(() => regionToViewport(settledRegion), [settledRegion]);
  const zoom = useMemo(() => approxZoom(settledRegion), [settledRegion]);
  const savedPlacesEnabled = useSyncExternalStore(
    savedPlacesMapLayerStore.subscribe,
    savedPlacesMapLayerStore.getSnapshot,
    savedPlacesMapLayerStore.getSnapshot,
  );

  const placeDiscovery = usePlaceMapDiscovery({
    viewport,
    zoom,
    enabled: viewport != null,
  });
  const savedPlacePoints = useSavedPlacesMapOverlay({
    enabled: savedPlacesEnabled,
    viewport,
  });
  const mergedPoints = useMemo(
    () => mergeMapDiscoveryPoints(
      points,
      placeDiscovery.data?.points ?? [],
      savedPlacePoints,
    ),
    [placeDiscovery.data?.points, points, savedPlacePoints],
  );

  const mapLibreEnabled = useAppSelector(
    (state) => state.mapRendererPolicy.mapLibreEnabled,
  );
  const validUntilMs = useAppSelector(
    (state) => state.mapRendererPolicy.validUntilMs,
  );
  const remoteMapLibreEnabled = mapLibreEnabled && validUntilMs > Date.now();
  const requestedRenderer = resolveRemoteMapRendererRequest(
    NEXA_MAP_RENDERER_ROLLOUT.requestedRenderer,
    remoteMapLibreEnabled,
  );

  const handleRegionChangeComplete = useCallback((region: Region): void => {
    setSettledRegion(region);
    onRegionChangeComplete(region);
  }, [onRegionChangeComplete]);

  const dismissPlacePreview = useCallback((): void => {
    placeSheetRef.current?.dismiss();
  }, []);

  const openPlacePreview = useCallback((point: PlaceMapEntityPoint): void => {
    setSelectedPlace(point);
    requestAnimationFrame(() => placeSheetRef.current?.present());
  }, []);

  const openPlaceDetails = useCallback((): void => {
    if (selectedPlace == null) return;
    const placeId = selectedPlace.id;
    dismissPlacePreview();
    navigation.navigate('PlaceDetail', { placeId });
  }, [dismissPlacePreview, navigation, selectedPlace]);

  const openPlaceCheckIn = useCallback((): void => {
    if (selectedPlace == null) return;
    const placeId = selectedPlace.id;
    setPendingPlaceCheckIn(placeId);
    dismissPlacePreview();
    navigation.navigate('PlaceDetail', { placeId });
  }, [dismissPlacePreview, navigation, selectedPlace]);

  const activeSelectionKey = selectedPlace == null
    ? selectedEntityKey
    : `place:${selectedPlace.id}`;
  const shouldDimUnselected = selectedPlace != null || dimUnselected;

  return (
    <>
      <NexaMapRuntimeSurface
        ref={ref}
        {...props}
        selectedEntityKey={activeSelectionKey}
        dimUnselected={shouldDimUnselected}
        points={mergedPoints}
        onRegionChangeComplete={handleRegionChangeComplete}
        onClusterPress={(point) => {
          if (selectedPlace != null) dismissPlacePreview();
          onClusterPress(point);
        }}
        onEntityPress={(point) => {
          if (point.kind === 'place') {
            openPlacePreview(point);
            return;
          }
          if (selectedPlace != null) dismissPlacePreview();
          onEntityPress(point);
        }}
        requestedRenderer={requestedRenderer}
        mapLibreAvailable={NEXA_MAP_RENDERER_ROLLOUT.mapLibreAvailable}
        mapLibreStyle={
          MAPLIBRE_STYLE_RUNTIME.status === 'ready'
            ? MAPLIBRE_STYLE_RUNTIME.styleUrl
            : null
        }
      />

      <BottomSheetModal
        ref={placeSheetRef}
        index={0}
        snapPoints={PLACE_PREVIEW_SNAP_POINTS}
        enableDynamicSizing={false}
        enablePanDownToClose
        onDismiss={() => setSelectedPlace(null)}
        backdropComponent={renderBackdrop}
        backgroundStyle={sheetChrome.background}
        handleIndicatorStyle={sheetChrome.handle}
      >
        <BottomSheetView style={sheetChrome.content}>
          {selectedPlace != null ? (
            <PlaceMapPreviewSheet
              point={selectedPlace}
              onCheckIn={openPlaceCheckIn}
              onViewDetails={openPlaceDetails}
            />
          ) : null}
        </BottomSheetView>
      </BottomSheetModal>
    </>
  );
});
