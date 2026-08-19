import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  InteractionManager,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import MapView, {
  PROVIDER_GOOGLE,
  type MapPressEvent,
  type Region,
} from 'react-native-maps';
import {
  BottomSheetModal,
  BottomSheetView,
} from '@gorhom/bottom-sheet';

import type {
  ApiError,
  DiscoveryPoint,
  EntityPoint,
  ClusterPoint,
  Viewport,
  WaveRequest,
  WaveResponse,
} from '@g88/shared';

import { useDiscovery } from '@/features/discovery/useDiscovery';
import { setPoints } from '@/features/discovery/discoverySlice';
import { useSocket } from '@/realtime/useSocket';
import { postJson } from '@/api/client';
import { useAppDispatch } from '@/hooks/redux';
import { useUserLocation } from '@/features/location/useUserLocation';
import { MapMarkers } from '@/components/map/MapMarkers';
import { prefetchAvatars } from '@/services/avatarCache';
import { EntityBottomSheet } from '@/components/map/EntityBottomSheet';
import { ErrorBoundary } from '@/components/ErrorBoundary';
import { challengeEvents } from '@/features/gamification/challengeEvents';
import { EventsRail } from '@/features/events/EventsRail';
import {
  fetchNearbyStories,
  storyReceived,
} from '@/features/stories/storiesSlice';
import { useFocusEffect, useNavigation, useRoute } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import type { RouteProp } from '@react-navigation/native';
import type { RootStackParamList, TabParamList } from '@/navigation/AppNavigator';
import { openRootScreen } from '@/navigation/openRootScreen';
import { track } from '@/lib/analytics';
import { colors } from '@/theme';
import { useReceivedInteractions } from '@/features/interactions/useReceivedInteractions';
import { MapCoachMarks } from '@/components/map/MapCoachMarks';
import { MapChrome } from '@/components/map/MapChrome';
import { sheetChrome, useSheetBackdrop } from '@/components/sheets';

const EMPTY_POINTS: DiscoveryPoint[] = [];

export function MapScreen(): React.JSX.Element {
  const dispatch = useAppDispatch();
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const route = useRoute<RouteProp<TabParamList, 'Map'>>();
  const { coords: myCoords, requestPermission } = useUserLocation();
  const [region, setRegion] = useState<Region | null>(null);
  const [selected, setSelected] = useState<EntityPoint | null>(null);
  const [waving, setWaving] = useState<string | null>(null);
  const mapRef = useRef<MapView>(null);
  const entitySheetRef = useRef<BottomSheetModal>(null);
  const presentedIdRef = useRef<string | null>(null);
  const entitySnapPoints = useMemo(() => ['42%', '58%'], []);
  const renderBackdrop = useSheetBackdrop(0.5);
  const { unreadCount: interactionUnread } = useReceivedInteractions();
  const focusMyPin = route.params?.focusMyPin === true;

  const viewport = useMemo<Viewport | null>(() => regionToViewport(region), [region]);
  const zoom = useMemo(() => (region ? approxZoomFromRegion(region) : 12), [region]);

  const { data, loading, error, refresh } = useDiscovery({ viewport, zoom });

  const points = data?.points ?? EMPTY_POINTS;

  const onCloseSheet = useCallback(() => {
    presentedIdRef.current = null;
    entitySheetRef.current?.dismiss();
    setSelected(null);
  }, []);

  const onEntityPress = useCallback((point: EntityPoint) => {
    setSelected(point);
  }, []);

  // Present once per selection id. InteractionManager avoids presenting mid-gesture.
  useEffect(() => {
    if (!selected) {
      presentedIdRef.current = null;
      return;
    }
    const id = `${selected.kind}:${selected.id}`;
    if (presentedIdRef.current === id) return;

    const task = InteractionManager.runAfterInteractions(() => {
      presentedIdRef.current = id;
      try {
        entitySheetRef.current?.present();
      } catch (e) {
        if (__DEV__) console.warn('entity sheet present failed', e);
        presentedIdRef.current = null;
      }
    });
    return () => task.cancel();
  }, [selected]);

  useEffect(() => {
    dispatch(setPoints(points));
  }, [points, dispatch]);

  useEffect(() => {
    const uris: Array<string | null> = [];
    for (const p of points) {
      if (p.kind === 'user') uris.push(p.meta.avatarUrl);
      else if (p.kind === 'event') uris.push(p.meta.coverUrl);
      else if (p.kind === 'listing') uris.push(p.meta.thumbnailUrl);
    }
    prefetchAvatars(uris);
  }, [points]);

  useEffect(() => {
    if (!myCoords || region || focusMyPin) return;
    mapRef.current?.animateToRegion(
      {
        latitude: myCoords.lat,
        longitude: myCoords.lng,
        latitudeDelta: 0.02,
        longitudeDelta: 0.02,
      },
      400,
    );
  }, [myCoords, region, focusMyPin]);

  useFocusEffect(
    useCallback(() => {
      if (!focusMyPin || !myCoords) return;
      mapRef.current?.animateToRegion(
        {
          latitude: myCoords.lat,
          longitude: myCoords.lng,
          latitudeDelta: 0.015,
          longitudeDelta: 0.015,
        },
        450,
      );
      navigation.setParams({ focusMyPin: undefined });
    }, [focusMyPin, myCoords, navigation]),
  );

  useEffect(() => {
    void requestPermission();
  }, [requestPermission]);

  const { sendPresence, on } = useSocket();

  useEffect(() => {
    if (!myCoords) return;
    void sendPresence({ location: myCoords });
    const t = setInterval(() => {
      if (myCoords) void sendPresence({ location: myCoords });
    }, 30_000);
    return () => clearInterval(t);
  }, [myCoords, sendPresence]);

  useEffect(() => {
    if (!viewport) return;
    const t = setTimeout(() => {
      void dispatch(fetchNearbyStories({ viewport, zoom }));
    }, 350);
    return () => clearTimeout(t);
  }, [viewport, zoom, dispatch]);

  useEffect(() => {
    const unsub = on('story:new', (e) => {
      dispatch(storyReceived(e));
    });
    return unsub;
  }, [on, dispatch]);

  const onClusterPress = useCallback((c: ClusterPoint) => {
    mapRef.current?.animateToRegion(
      {
        latitude: c.lat,
        longitude: c.lng,
        latitudeDelta: Math.max(0.005, (region?.latitudeDelta ?? 0.05) / 2.5),
        longitudeDelta: Math.max(0.005, (region?.longitudeDelta ?? 0.05) / 2.5),
      },
      300,
    );
  }, [region?.latitudeDelta, region?.longitudeDelta]);

  const onWave = useCallback(async (toUserId: string) => {
    setWaving(toUserId);
    try {
      const res = await postJson<WaveRequest, WaveResponse>('/interactions/wave', {
        toUserId,
        context: 'map',
      });
      challengeEvents.emit('progress');
      if (res.conversationId) {
        navigation.navigate('Chat', {
          conversationId: res.conversationId,
          otherUserName: '',
        });
      }
    } catch (e) {
      if (__DEV__) {
        console.warn('wave failed', e);
      }
      throw e;
    } finally {
      setWaving(null);
    }
  }, [navigation]);

  const onSheetWave = useCallback((toUserId: string) => {
    onWave(toUserId).catch((err: ApiError) => {
      Alert.alert(
        err.code === 'wave.cooldown' ? 'Already waved' : 'Could not send wave',
        err.message || 'Try again in a moment.',
      );
    });
  }, [onWave]);

  const onSheetWavePress = useCallback(() => {
    if (selected?.kind === 'user') {
      onSheetWave(selected.id);
    }
  }, [selected, onSheetWave]);

  /** Long-press empty map → create menu (replaces FAB). */
  const onMapLongPress = useCallback(
    (e: MapPressEvent) => {
      if (selected) return; // entity sheet owns the surface
      const { latitude, longitude } = e.nativeEvent.coordinate;
      track('map.longpress_create', { lat: latitude, lng: longitude });
      Alert.alert('Create nearby', 'What do you want to post at this spot?', [
        {
          text: 'List item',
          onPress: () => {
            track('map.create_choice', { kind: 'listing' });
            openRootScreen(navigation, 'ListingCreate');
          },
        },
        {
          text: 'Create event',
          onPress: () => {
            track('map.create_choice', { kind: 'event' });
            openRootScreen(navigation, 'EventCreate');
          },
        },
        {
          text: 'Post alert',
          onPress: () => {
            track('map.create_choice', { kind: 'alert' });
            openRootScreen(navigation, 'AlertComposer');
          },
        },
        { text: 'Cancel', style: 'cancel' },
      ]);
    },
    [navigation, selected],
  );

  const sheetOpen = selected != null;

  return (
    <View style={styles.root}>
      <ErrorBoundary fallback={<MapUnavailableFallback />}>
        <MapView
          ref={mapRef}
          provider={PROVIDER_GOOGLE}
          style={StyleSheet.absoluteFill}
          showsUserLocation
          showsMyLocationButton={false}
          showsCompass={false}
          toolbarEnabled={false}
          onRegionChangeComplete={setRegion}
          onLongPress={onMapLongPress}
          initialRegion={{
            latitude: 43.21,
            longitude: 27.92,
            latitudeDelta: 0.05,
            longitudeDelta: 0.05,
          }}
        >
          <MapMarkers
            points={points}
            onClusterPress={onClusterPress}
            onEntityPress={onEntityPress}
          />
        </MapView>
      </ErrorBoundary>

      {loading && (
        <View style={styles.loading} pointerEvents="none">
          <ActivityIndicator />
        </View>
      )}
      {error && (
        <View style={styles.errorBanner}>
          <Text style={styles.errorText}>{error}</Text>
          <TouchableOpacity onPress={refresh}>
            <Text style={styles.retry}>Retry</Text>
          </TouchableOpacity>
        </View>
      )}

      <MapChrome
        sheetOpen={sheetOpen}
        interactionUnread={interactionUnread}
        onPressInteractions={() => openRootScreen(navigation, 'Interactions')}
      />

      {!sheetOpen && (
        <EventsRail location={region ? { lat: region.latitude, lng: region.longitude } : myCoords} />
      )}

      {!sheetOpen && <MapCoachMarks mapReady={region != null} />}

      <BottomSheetModal
        ref={entitySheetRef}
        snapPoints={entitySnapPoints}
        enablePanDownToClose
        enableDynamicSizing={false}
        backdropComponent={renderBackdrop}
        backgroundStyle={sheetChrome.background}
        handleIndicatorStyle={sheetChrome.handle}
        onDismiss={() => {
          presentedIdRef.current = null;
          setSelected(null);
        }}
      >
        <BottomSheetView style={sheetChrome.content}>
          {selected ? (
            <ErrorBoundary fallback={<Text style={styles.sheetError}>Could not load card</Text>}>
              <EntityBottomSheet
                point={selected}
                waving={selected.kind === 'user' && waving === selected.id}
                onClose={onCloseSheet}
                {...(selected.kind === 'user' && { onWave: onSheetWavePress })}
              />
            </ErrorBoundary>
          ) : null}
        </BottomSheetView>
      </BottomSheetModal>
    </View>
  );
}

function MapUnavailableFallback(): React.JSX.Element {
  return (
    <View style={[StyleSheet.absoluteFill, styles.unavailable]}>
      <Text style={styles.unavailableTitle}>Map unavailable</Text>
      <Text style={styles.unavailableBody}>
        Google Maps could not be initialized. Verify your API key in local.properties.
      </Text>
    </View>
  );
}

function regionToViewport(r: Region | null): Viewport | null {
  if (!r) return null;
  const halfLat = r.latitudeDelta / 2;
  const halfLng = r.longitudeDelta / 2;
  return {
    ne: { lat: r.latitude + halfLat, lng: r.longitude + halfLng },
    sw: { lat: r.latitude - halfLat, lng: r.longitude - halfLng },
  };
}

function approxZoomFromRegion(r: Region): number {
  const z = Math.log2(360 / Math.max(r.latitudeDelta, 0.0001));
  return Math.max(0, Math.min(22, Math.round(z)));
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.bg },
  unavailable: {
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: colors.bg,
    padding: 24,
  },
  unavailableTitle: { color: colors.danger, fontSize: 16, fontWeight: '700', marginBottom: 8 },
  unavailableBody: { color: colors.textMuted, fontSize: 13, textAlign: 'center', lineHeight: 20 },
  loading: {
    position: 'absolute',
    top: 120,
    alignSelf: 'center',
    padding: 8,
    borderRadius: 16,
    backgroundColor: 'rgba(0,0,0,0.5)',
  },
  errorBanner: {
    position: 'absolute',
    bottom: 32,
    left: 16,
    right: 16,
    padding: 12,
    borderRadius: 12,
    backgroundColor: colors.danger,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  errorText: { color: colors.textPrimary, flex: 1 },
  retry: { color: colors.textPrimary, fontWeight: '600' },
  sheetError: { color: colors.textMuted, padding: 16, textAlign: 'center' },
});
