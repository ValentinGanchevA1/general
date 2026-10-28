import React, {
  useCallback,
  useMemo,
  useRef,
  useState,
  useSyncExternalStore,
} from 'react';
import type { Region } from 'react-native-maps';
import { useFocusEffect, useNavigation } from '@react-navigation/native';
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
import { useAppDispatch, useAppSelector } from '@/hooks/redux';
import type { RootStackParamList } from '@/navigation/AppNavigator';
import { useSheetBackdrop, useSheetChrome } from '@/components/sheets';
import { PlaceMapPreviewSheet } from '@/features/places/PlaceMapPreviewSheet';
import { loadSavedPlaces, setPlaceSaved } from '@/features/places/placeDetailSlice';
import { setPendingPlaceCheckIn } from '@/features/places/pendingPlaceCheckIn';
import { savedPlaceMapFocusStore } from '@/features/places/savedPlaceMapFocus.store';
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
  onPlacePreviewVisibilityChange?: (visible: boolean) => void;
};

const MAPLIBRE_STYLE_RUNTIME = resolveMapLibreStyleRuntime({
  apiKey: Config.MAPTILER_API_KEY,
  mapId: Config.MAPTILER_MAP_ID,
  region: Config.MAPTILER_REGION,
});

const PLACE_PREVIEW_SNAP_POINTS: Array<string | number> = ['34%'];
const SAVED_PLACE_FOCUS_ZOOM = 15;
const SAVED_PLACE_FOCUS_DURATION_MS = 360;

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
    onPlacePreviewVisibilityChange,
    selectedEntityKey,
    dimUnselected,
    ...props
  },
  ref,
): React.JSX.Element {
  useMapRendererPolicyLifecycle();

  const dispatch = useAppDispatch();
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const sheetChrome = useSheetChrome();
  const renderBackdrop = useSheetBackdrop(0.35);
  const runtimeMapRef = useRef<NexaMapController | null>(null);
  const placeSheetRef = useRef<BottomSheetModal>(null);
  const handledFocusRequestIdRef = useRef<number | null>(null);
  const privateSelectedPlaceIdRef = useRef<string | null>(null);
  const selectedPlaceIdRef = useRef<string | null>(null);
  const [selectedPlace, setSelectedPlace] = useState<PlaceMapEntityPoint | null>(null);
  selectedPlaceIdRef.current = selectedPlace?.id ?? null;
  const [settledRegion, setSettledRegion] = useState<Region | null>(null);
  const viewport = useMemo(() => regionToViewport(settledRegion), [settledRegion]);
  const zoom = useMemo(() => approxZoom(settledRegion), [settledRegion]);
  const savedPlacesEnabled = useSyncExternalStore(
    savedPlacesMapLayerStore.subscribe,
    savedPlacesMapLayerStore.getSnapshot,
    savedPlacesMapLayerStore.getSnapshot,
  );
  const savedPlaceFocusRequest = useSyncExternalStore(
    savedPlaceMapFocusStore.subscribe,
    savedPlaceMapFocusStore.getSnapshot,
    savedPlaceMapFocusStore.getSnapshot,
  );
  const selectedPlaceEntry = useAppSelector((state) => (
    selectedPlace == null ? undefined : state.places.entries[selectedPlace.id]
  ));
  const saveLoading = selectedPlaceEntry?.saveId != null;
  const saveError = selectedPlaceEntry?.saveError ?? null;

  React.useImperativeHandle(ref, () => ({
    flyTo(target, options) {
      runtimeMapRef.current?.flyTo(target, options);
    },
    fitViewport(targetViewport, options) {
      runtimeMapRef.current?.fitViewport(targetViewport, options);
    },
  }), []);

  React.useEffect(() => () => {
    onPlacePreviewVisibilityChange?.(false);
  }, [onPlacePreviewVisibilityChange]);

  const placeDiscovery = usePlaceMapDiscovery({
    viewport,
    zoom,
    enabled: viewport != null,
  });
  const savedPlacePoints = useSavedPlacesMapOverlay({
    enabled: savedPlacesEnabled,
    viewport,
  });
  const privateSavedPlacePoints = useMemo(() => {
    const candidates: PlaceMapEntityPoint[] = [];
    const focused = savedPlaceFocusRequest?.point;
    if (focused != null) candidates.push(focused);
    if (
      selectedPlace?.meta.saved === true &&
      selectedPlace.id !== focused?.id
    ) {
      candidates.push(selectedPlace);
    }
    const candidateIds = new Set(candidates.map((point) => point.id));
    return [
      ...candidates,
      ...savedPlacePoints.filter((point) => !candidateIds.has(point.id)),
    ];
  }, [savedPlaceFocusRequest, savedPlacePoints, selectedPlace]);
  const mergedPoints = useMemo(
    () => mergeMapDiscoveryPoints(
      points,
      placeDiscovery.data?.points ?? [],
      privateSavedPlacePoints,
    ),
    [placeDiscovery.data?.points, points, privateSavedPlacePoints],
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
    privateSelectedPlaceIdRef.current = point.meta.saved === true ? point.id : null;
    setSelectedPlace(point);
    requestAnimationFrame(() => {
      const sheet = placeSheetRef.current;
      if (sheet == null) return;
      sheet.present();
      onPlacePreviewVisibilityChange?.(true);
    });
  }, [onPlacePreviewVisibilityChange]);

  useFocusEffect(useCallback(() => {
    if (savedPlaceFocusRequest == null) return;
    if (handledFocusRequestIdRef.current === savedPlaceFocusRequest.requestId) return;
    handledFocusRequestIdRef.current = savedPlaceFocusRequest.requestId;

    const frame = requestAnimationFrame(() => {
      runtimeMapRef.current?.flyTo(
        {
          center: {
            latitude: savedPlaceFocusRequest.point.lat,
            longitude: savedPlaceFocusRequest.point.lng,
          },
          zoom: SAVED_PLACE_FOCUS_ZOOM,
        },
        { durationMs: SAVED_PLACE_FOCUS_DURATION_MS },
      );
      openPlacePreview(savedPlaceFocusRequest.point);
    });

    return () => cancelAnimationFrame(frame);
  }, [openPlacePreview, savedPlaceFocusRequest]));

  React.useEffect(() => {
    if (savedPlacesEnabled || selectedPlace == null) return;
    if (privateSelectedPlaceIdRef.current !== selectedPlace.id) return;
    const frame = requestAnimationFrame(() => placeSheetRef.current?.dismiss());
    return () => cancelAnimationFrame(frame);
  }, [savedPlacesEnabled, selectedPlace]);

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

  const togglePlaceSaved = useCallback(async (): Promise<void> => {
    const point = selectedPlace;
    if (point == null || saveLoading) return;
    const nextSaved = point.meta.saved !== true;

    const result = await dispatch(setPlaceSaved({ placeId: point.id, saved: nextSaved }));
    if (!setPlaceSaved.fulfilled.match(result)) return;

    const currentSelectedId = selectedPlaceIdRef.current;
    if (
      currentSelectedId !== point.id &&
      currentSelectedId !== result.payload.placeId
    ) {
      return;
    }

    const wasPrivateSelected = privateSelectedPlaceIdRef.current === point.id;
    const updatedPoint: PlaceMapEntityPoint = {
      ...point,
      id: result.payload.placeId,
      meta: {
        ...point.meta,
        saved: result.payload.saved,
      },
    };

    if (wasPrivateSelected) {
      privateSelectedPlaceIdRef.current = result.payload.saved
        ? result.payload.placeId
        : null;
    }
    setSelectedPlace(updatedPoint);

    if (result.payload.saved) {
      if (savedPlacesEnabled) {
        void dispatch(loadSavedPlaces({ reset: true }));
      }
      return;
    }

    savedPlaceMapFocusStore.clear();
    if (point.meta.trending) return;

    requestAnimationFrame(() => {
      const selectedId = selectedPlaceIdRef.current;
      if (
        selectedId === point.id ||
        selectedId === result.payload.placeId
      ) {
        placeSheetRef.current?.dismiss();
      }
    });
  }, [dispatch, saveLoading, savedPlacesEnabled, selectedPlace]);

  const activeSelectionKey = selectedPlace == null
    ? selectedEntityKey
    : `place:${selectedPlace.id}`;
  const shouldDimUnselected = selectedPlace != null || dimUnselected;

  return (
    <>
      <NexaMapRuntimeSurface
        ref={runtimeMapRef}
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
        onDismiss={() => {
          onPlacePreviewVisibilityChange?.(false);
          privateSelectedPlaceIdRef.current = null;
          setSelectedPlace(null);
          savedPlaceMapFocusStore.clear();
        }}
        backdropComponent={renderBackdrop}
        backgroundStyle={sheetChrome.background}
        handleIndicatorStyle={sheetChrome.handle}
      >
        <BottomSheetView style={sheetChrome.content}>
          {selectedPlace != null ? (
            <PlaceMapPreviewSheet
              point={selectedPlace}
              onCheckIn={openPlaceCheckIn}
              onToggleSaved={() => {
                void togglePlaceSaved();
              }}
              onViewDetails={openPlaceDetails}
              saveLoading={saveLoading}
              saveError={saveError}
            />
          ) : null}
        </BottomSheetView>
      </BottomSheetModal>
    </>
  );
});
