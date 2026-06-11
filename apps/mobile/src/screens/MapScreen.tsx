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
  type LatLng as RNLatLng,
  Marker,
  PROVIDER_GOOGLE,
  type Region,
} from 'react-native-maps';

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
import { ClusterMarker } from '@/components/map/ClusterMarker';
import { EntityMarker } from '@/components/map/EntityMarker';
import { EntityBottomSheet } from '@/components/map/EntityBottomSheet';
import { ErrorBoundary } from '@/components/ErrorBoundary';
import { ContextualFab } from '@/components/ContextualFab';
import type { FabActionId } from '@/components/ContextualFab/useFabContext';
import { DailyChallengeCard } from '@/features/gamification/DailyChallengeCard';
import { track } from '@/lib/analytics';

/**
 * MapScreen
 * ─────────
 * Owns:
 *   • map region state (debounced viewport handoff to useDiscovery)
 *   • a tap-to-open bottom sheet for the selected entity
 *   • the presence heartbeat (sends location every ~30s while screen mounted)
 *   • the wave-send action with optimistic UX
 *
 * Does NOT own:
 *   • clustering math (server)
 *   • token refresh (axios interceptor)
 *   • socket lifecycle (useSocket singleton)
 */
export function MapScreen(): React.JSX.Element {
  const dispatch = useAppDispatch();
  const { coords: myCoords, requestPermission } = useUserLocation();
  const [region, setRegion] = useState<Region | null>(null);
  const [selected, setSelected] = useState<EntityPoint | null>(null);
  const [waving, setWaving] = useState<string | null>(null);
  const mapRef = useRef<MapView>(null);

  // ─── Viewport derivation ───────────────────────────────────────────────
  const viewport = useMemo<Viewport | null>(() => regionToViewport(region), [region]);
  const zoom = useMemo(() => (region ? approxZoomFromRegion(region) : 12), [region]);

  const { data, loading, error, refresh } = useDiscovery({ viewport, zoom });

  // Sync discovery points to Redux so PulseScreen's NearbyPeopleStrip can read them.
  useEffect(() => {
    dispatch(setPoints(data?.points ?? []));
  }, [data, dispatch]);

  // ─── Centre on user on first location fix ──────────────────────────────
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

  // ─── Realtime: send presence, react to incoming waves ──────────────────
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
      // TODO: toast + push to a "waves" badge in the tab bar.
      // eslint-disable-next-line no-console
      console.log(`👋 wave from ${e.fromUser.displayName}`);
      // A new wave from someone visible on the map may reflect new presence — refresh.
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

  // ─── Cluster tap → zoom in ─────────────────────────────────────────────
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
  }, [region]);

  // ─── Wave (optimistic) ─────────────────────────────────────────────────
  const onWave = useCallback(async (toUserId: string) => {
    setWaving(toUserId);
    try {
      const res = await postJson<WaveRequest, WaveResponse>('/interactions/wave', {
        toUserId,
        context: 'map',
      });
      if (res.conversationId) {
        // TODO: navigate to chat
      }
    } catch (e) {
      // eslint-disable-next-line no-console
      console.warn('wave failed', e);
      throw e; // re-throw so callers (fab.conversion) can record the real outcome
    } finally {
      setWaving(null);
    }
  }, []);

  // Bottom-sheet wave is fire-and-forget: onWave re-throws so the FAB path can
  // record conversion, so here we must swallow the rejection ourselves. A 409
  // cooldown is an expected outcome — surface the (user-friendly) server message
  // instead of letting it bubble up as an unhandled promise rejection.
  const onSheetWave = useCallback((toUserId: string) => {
    onWave(toUserId).catch((err: ApiError) => {
      Alert.alert(
        err.code === 'wave.cooldown' ? 'Already waved' : 'Could not send wave',
        err.message || 'Try again in a moment.',
      );
    });
  }, [onWave]);

  // ─── Render ────────────────────────────────────────────────────────────
  const nearestUserId = useMemo(() => {
    if (!myCoords) return null;
    const users = (data?.points ?? []).filter((p): p is EntityPoint => p.kind === 'user');
    if (!users.length) return null;
    return users.reduce((best, p) =>
      squaredDist(myCoords, p) < squaredDist(myCoords, best) ? p : best,
    ).id;
  }, [data, myCoords]);

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
    return false;
  }, [nearestUserId, onWave]);

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
          {(data?.points ?? []).map((p) =>
            p.kind === 'cluster' ? (
              <Marker
                key={`c:${p.cellId}`}
                coordinate={toRNLatLng(p)}
                onPress={() => onClusterPress(p)}
                tracksViewChanges={false}
              >
                <ClusterMarker point={p} />
              </Marker>
            ) : (
              <Marker
                key={`e:${p.kind}:${p.id}`}
                coordinate={toRNLatLng(p)}
                onPress={() => setSelected(p)}
                tracksViewChanges={false}
              >
                <EntityMarker point={p} />
              </Marker>
            ),
          )}
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

      <DailyChallengeCard />

      {selected && (
        <EntityBottomSheet
          point={selected}
          waving={selected.kind === 'user' && waving === selected.id}
          onClose={() => setSelected(null)}
          {...(selected.kind === 'user' && { onWave: () => onSheetWave(selected.id) })}
        />
      )}

      <ContextualFab
        zoom={zoom}
        points={data?.points ?? []}
        nearestUserId={nearestUserId}
        onAction={onFabAction}
      />
    </View>
  );
}

// ─── Fallback ─────────────────────────────────────────────────────────────

function MapUnavailableFallback(): React.JSX.Element {
  return (
    <View style={[StyleSheet.absoluteFill, styles.unavailable]}>
      <Text style={styles.unavailableTitle}>Map unavailable</Text>
      <Text style={styles.unavailableBody}>
        Google Maps could not be initialized.{'\n'}Verify your API key in local.properties.
      </Text>
    </View>
  );
}

// ─── Helpers ─────────────────────────────────────────────────────────────

function squaredDist(a: { lat: number; lng: number }, b: { lat: number; lng: number }): number {
  const dlat = a.lat - b.lat;
  const dlng = a.lng - b.lng;
  return dlat * dlat + dlng * dlng;
}

function toRNLatLng(p: DiscoveryPoint): RNLatLng {
  return { latitude: p.lat, longitude: p.lng };
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

/**
 * Rough mapping from latitudeDelta to zoom level.
 * Good enough for picking an H3 resolution; not used for any UI math.
 * Reference: at the equator, zoom z ≈ log2(360 / latitudeDelta).
 */
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
});
