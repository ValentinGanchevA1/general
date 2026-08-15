import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import MapView, {
  PROVIDER_GOOGLE,
  type Region,
} from 'react-native-maps';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

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
import { EntityBottomSheet } from '@/components/map/EntityBottomSheet';
import { ErrorBoundary } from '@/components/ErrorBoundary';
import { ContextualFab } from '@/components/ContextualFab';
import type { FabActionId } from '@/components/ContextualFab/useFabContext';
import { DailyChallengeCard, CHALLENGE_CARD_HEIGHT } from '@/features/gamification/DailyChallengeCard';
import { challengeEvents } from '@/features/gamification/challengeEvents';
import { NudgeBanner } from '@/features/nudges/NudgeBanner';
import { EventsRail } from '@/features/events/EventsRail';
import {
  fetchNearbyStories,
  storyReceived,
} from '@/features/stories/storiesSlice';
import { useFocusEffect, useNavigation, useRoute } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import type { RouteProp } from '@react-navigation/native';
import type { RootStackParamList, TabParamList } from '@/navigation/AppNavigator';
import { track } from '@/lib/analytics';
import { useReceivedInteractions } from '@/features/interactions/useReceivedInteractions';
import { MapCoachMarks } from '@/components/map/MapCoachMarks';

const EMPTY_POINTS: DiscoveryPoint[] = [];

/** Nudge card approx height for stacking interactions badge under challenge + streak. */
const NUDGE_CARD_HEIGHT = 56;

export function MapScreen(): React.JSX.Element {
  const dispatch = useAppDispatch();
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const route = useRoute<RouteProp<TabParamList, 'Map'>>();
  const insets = useSafeAreaInsets();
  const { coords: myCoords, requestPermission } = useUserLocation();
  const [region, setRegion] = useState<Region | null>(null);
  const [selected, setSelected] = useState<EntityPoint | null>(null);
  const [waving, setWaving] = useState<string | null>(null);
  const mapRef = useRef<MapView>(null);
  const { unreadCount: interactionUnread } = useReceivedInteractions();
  const focusMyPin = route.params?.focusMyPin === true;

  const viewport = useMemo<Viewport | null>(() => regionToViewport(region), [region]);
  const zoom = useMemo(() => (region ? approxZoomFromRegion(region) : 12), [region]);

  const { data, loading, error, refresh } = useDiscovery({ viewport, zoom });

  const points = data?.points ?? EMPTY_POINTS;

  // Challenge + optional streak stack at top; interactions badge sits below both.
  const topStackHeight =
    insets.top + 8 + CHALLENGE_CARD_HEIGHT + 8 + NUDGE_CARD_HEIGHT + 8;
  const badgeTop = selected ? insets.top + 8 : topStackHeight;

  const onCloseSheet = useCallback(() => {
    setSelected(null);
  }, []);

  useEffect(() => {
    dispatch(setPoints(points));
  }, [points, dispatch]);

  // Initial centre when we first get GPS and the user has not panned yet.
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

  // Profile → "View my pin on map": force-centre on the user once GPS is ready, then clear the flag.
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
      // Clear so a later tab switch does not re-fire.
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
    const unsub = on('wave:received', (e) => {
      if (__DEV__) {
        console.log(`wave from ${e.fromUser.displayName}`);
      }
      Alert.alert(
        `${e.fromUser.displayName} waved at you`,
        'Wave back or chat with them on the map.',
      );
      refresh();
    });
    return unsub;
  }, [on, refresh]);

  useEffect(() => {
    const unsub = on('gift:received', (e) => {
      Alert.alert(
        `${e.sender.displayName} sent you a gift ${e.emoji}`,
        e.message ? `${e.label} — “${e.message}”` : `You received a ${e.label}.`,
      );
    });
    return unsub;
  }, [on]);

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

  const nearestUserId = useMemo(() => {
    if (!myCoords) return null;
    const users = points.filter((p): p is EntityPoint => p.kind === 'user');
    if (!users.length) return null;
    return users.reduce((best, p) =>
      squaredDist(myCoords, p) < squaredDist(myCoords, best) ? p : best,
    ).id;
  }, [myCoords, points]);

  const onFabAction = useCallback(async (id: FabActionId, contextKey: string): Promise<boolean> => {
    if (id === 'wave_nearest' && nearestUserId) {
      const t0 = Date.now();
      try {
        await onWave(nearestUserId);
        track('fab.conversion', { contextKey, actionId: id, latencyMs: Date.now() - t0, success: true });
      } catch {
        track('fab.conversion', { contextKey, actionId: id, latencyMs: Date.now() - t0, success: false });
      }
      return true;
    }
    if (id === 'create_listing') {
      navigation.navigate('Marketplace');
      return true;
    }
    return false;
  }, [nearestUserId, onWave, navigation]);

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
            onEntityPress={setSelected}
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

      {/* Challenge max top; streak under it; stories on Pulse only. */}
      {!selected && <DailyChallengeCard />}
      {!selected && <NudgeBanner />}

      {/* Interactions entry — people who waved / reacted */}
      <TouchableOpacity
        style={[styles.interactionBadge, { top: badgeTop }]}
        onPress={() => navigation.navigate('Interactions')}
        activeOpacity={0.85}
      >
        <Text style={styles.interactionBadgeIcon}>👋</Text>
        {interactionUnread > 0 ? (
          <View style={styles.interactionBadgeDot}>
            <Text style={styles.interactionBadgeCount}>
              {interactionUnread > 9 ? '9+' : interactionUnread}
            </Text>
          </View>
        ) : null}
      </TouchableOpacity>

      {!selected && (
        <EventsRail location={region ? { lat: region.latitude, lng: region.longitude } : myCoords} />
      )}

      {selected && (
        <EntityBottomSheet
          point={selected}
          waving={selected.kind === 'user' && waving === selected.id}
          onClose={onCloseSheet}
          {...(selected.kind === 'user' && { onWave: onSheetWavePress })}
        />
      )}

      {/* FAB maximum bottom — no EventsRail lift. Hide while entity sheet open. */}
      {!selected && (
        <ContextualFab
          zoom={zoom}
          points={points}
          nearestUserId={nearestUserId}
          onAction={onFabAction}
          bottomOffset={0}
        />
      )}

      {/* First-session coach: people → wave → create. Once dismissed, never again. */}
      {!selected && <MapCoachMarks mapReady={region != null} />}
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

function squaredDist(a: { lat: number; lng: number }, b: { lat: number; lng: number }): number {
  const dlat = a.lat - b.lat;
  const dlng = a.lng - b.lng;
  return dlat * dlat + dlng * dlng;
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
  root: { flex: 1, backgroundColor: '#000' },
  unavailable: {
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#0a0a0f',
    padding: 24,
  },
  unavailableTitle: { color: '#ff6b6b', fontSize: 16, fontWeight: '700', marginBottom: 8 },
  unavailableBody: { color: '#888', fontSize: 13, textAlign: 'center', lineHeight: 20 },
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
    backgroundColor: '#a32d2d',
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  errorText: { color: 'white', flex: 1 },
  retry: { color: 'white', fontWeight: '600' },

  interactionBadge: {
    position: 'absolute',
    right: 16,
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: '#1a1a2e',
    borderWidth: 1,
    borderColor: '#2a2a4a',
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 20,
  },
  interactionBadgeIcon: { fontSize: 20 },
  interactionBadgeDot: {
    position: 'absolute',
    top: -2,
    right: -2,
    minWidth: 18,
    height: 18,
    borderRadius: 9,
    backgroundColor: '#ff3b5c',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 4,
  },
  interactionBadgeCount: { color: '#fff', fontSize: 10, fontWeight: '700' },
});
