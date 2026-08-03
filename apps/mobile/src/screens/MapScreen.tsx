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

import type {
  ApiError,
  DiscoveryPoint,
  EntityPoint,
  ClusterPoint,
  StoryCard,
  Viewport,
  WaveRequest,
  WaveResponse,
} from '@g88/shared';

import { useDiscovery } from '@/features/discovery/useDiscovery';
import { setPoints } from '@/features/discovery/discoverySlice';
import { useSocket } from '@/realtime/useSocket';
import { postJson } from '@/api/client';
import { useAppDispatch, useAppSelector } from '@/hooks/redux';
import { useUserLocation } from '@/features/location/useUserLocation';
import { MapMarkers } from '@/components/map/MapMarkers';
import { EntityBottomSheet } from '@/components/map/EntityBottomSheet';
import { ErrorBoundary } from '@/components/ErrorBoundary';
import { ContextualFab } from '@/components/ContextualFab';
import type { FabActionId } from '@/components/ContextualFab/useFabContext';
import { DailyChallengeCard } from '@/features/gamification/DailyChallengeCard';
import { challengeEvents } from '@/features/gamification/challengeEvents';
import { NudgeBanner } from '@/features/nudges/NudgeBanner';
import { EventsRail, EVENTS_RAIL_HEIGHT } from '@/features/events/EventsRail';
import { TrendingFilterBar } from '@/features/discovery/TrendingFilterBar';
import { useTrendingNearby } from '@/features/pulse/useTrendingNearby';
import {
  PulseStrip,
  PULSE_STRIP_HEIGHT,
} from '@/features/stories/components/PulseStrip';
import { StoryViewer } from '@/features/stories/components/StoryViewer';
import { StoryCreateSheet } from '@/features/stories/components/StoryCreateSheet';
import {
  fetchNearbyStories,
  storyReceived,
} from '@/features/stories/storiesSlice';
import { pickAndUploadStoryMedia } from '@/features/stories/storyMedia';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import type { RootStackParamList } from '@/navigation/AppNavigator';
import { track } from '@/lib/analytics';

/** Stable empty list — avoids new [] identity every render when data is null. */
const EMPTY_POINTS: DiscoveryPoint[] = [];

/**
 * MapScreen
 * ---------
 * Owns:
 *   - map region state (debounced viewport handoff to useDiscovery)
 *   - a tap-to-open bottom sheet for the selected entity
 *   - the presence heartbeat (sends location every ~30s while screen mounted)
 *   - the wave-send action with optimistic UX
 *   - PulseStrip stories (viewport fetch + story:new realtime)
 *
 * Does NOT own:
 *   - clustering math (server)
 *   - token refresh (axios interceptor)
 *   - socket lifecycle (useSocket singleton)
 *   - marker reconcile (MapMarkers — isolated from chrome re-renders)
 */
export function MapScreen(): React.JSX.Element {
  const dispatch = useAppDispatch();
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const { coords: myCoords, requestPermission } = useUserLocation();
  const [region, setRegion] = useState<Region | null>(null);
  const [selected, setSelected] = useState<EntityPoint | null>(null);
  const [waving, setWaving] = useState<string | null>(null);
  const [activeTopic, setActiveTopic] = useState<string | null>(null);
  const [viewerOpen, setViewerOpen] = useState(false);
  const [viewerIndex, setViewerIndex] = useState(0);
  const [createOpen, setCreateOpen] = useState(false);
  const mapRef = useRef<MapView>(null);
  const nearbyStories = useAppSelector((s) => s.stories.nearby);

  // --- Viewport derivation ------------------------------------------------
  const viewport = useMemo<Viewport | null>(() => regionToViewport(region), [region]);
  const zoom = useMemo(() => (region ? approxZoomFromRegion(region) : 12), [region]);

  const { topics: trendingTopics } = useTrendingNearby();
  const { data, loading, error, refresh } = useDiscovery({ viewport, zoom, topic: activeTopic });

  const points = data?.points ?? EMPTY_POINTS;

  const onSelectTopic = useCallback((topic: string | null) => {
    setActiveTopic(topic);
    track('trending.filter', { topic: topic ?? 'cleared' });
  }, []);

  const onCloseSheet = useCallback(() => {
    setSelected(null);
  }, []);

  // Sync discovery points to Redux so PulseScreen's NearbyPeopleStrip can read them.
  useEffect(() => {
    dispatch(setPoints(points));
  }, [points, dispatch]);

  // --- Centre on user on first location fix -------------------------------
  useEffect(() => {
    if (!myCoords || region) return;
    mapRef.current?.animateToRegion(
      {
        latitude: myCoords.lat,
        longitude: myCoords.lng,
        latitudeDelta: 0.02,
        longitudeDelta: 0.02,
      },
      400,
    );
  }, [myCoords, region]);

  useEffect(() => {
    void requestPermission();
  }, [requestPermission]);

  // --- Realtime: send presence, react to incoming waves -------------------
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

  // --- Stories: viewport fetch + realtime story:new -----------------------
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

  const onOpenStory = useCallback((story: StoryCard, index: number) => {
    setViewerIndex(index);
    setViewerOpen(true);
    track('story.open', { storyId: story.id, index });
  }, []);

  const onCreatePress = useCallback(() => {
    setCreateOpen(true);
    track('story.create_open', {});
  }, []);

  // --- Cluster tap to zoom in ---------------------------------------------
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

  // --- Wave (optimistic) --------------------------------------------------
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

  // --- Render -------------------------------------------------------------
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

      {!selected && (
        <View style={styles.pulseWrap} pointerEvents="box-none">
          <PulseStrip onOpenStory={onOpenStory} onCreatePress={onCreatePress} />
        </View>
      )}

      <TrendingFilterBar
        topics={trendingTopics}
        activeTopic={activeTopic}
        onSelect={onSelectTopic}
        topOffset={selected ? 52 : 48 + PULSE_STRIP_HEIGHT}
      />
      <DailyChallengeCard />
      <NudgeBanner />

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

      <ContextualFab
        zoom={zoom}
        points={points}
        nearestUserId={nearestUserId}
        onAction={onFabAction}
        bottomOffset={selected ? 0 : EVENTS_RAIL_HEIGHT}
      />

      <StoryViewer
        stories={nearbyStories}
        initialIndex={viewerIndex}
        visible={viewerOpen}
        onClose={() => setViewerOpen(false)}
      />

      <StoryCreateSheet
        visible={createOpen}
        onClose={() => setCreateOpen(false)}
        location={myCoords}
        pickAndUpload={pickAndUploadStoryMedia}
      />
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

/** Rough mapping from latitudeDelta to zoom level for H3 resolution. */
function approxZoomFromRegion(r: Region): number {
  const z = Math.log2(360 / Math.max(r.latitudeDelta, 0.0001));
  return Math.max(0, Math.min(22, Math.round(z)));
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: '#000' },
  pulseWrap: {
    position: 'absolute',
    top: 48,
    left: 0,
    right: 0,
    zIndex: 5,
  },
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
});
