import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
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
  DiscoveryPoint,
  EntityPoint,
  ClusterPoint,
  Viewport,
  WaveRequest,
  WaveResponse,
} from '@g88/shared';

import { useDiscovery } from '@/features/discovery/useDiscovery';
import { useSocket } from '@/realtime/useSocket';
import { postJson } from '@/api/client';
import { useUserLocation } from '@/features/location/useUserLocation';
import { ClusterMarker } from '@/components/map/ClusterMarker';
import { EntityMarker } from '@/components/map/EntityMarker';
import { EntityBottomSheet } from '@/components/map/EntityBottomSheet';

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
  const { coords: myCoords, requestPermission } = useUserLocation();
  const [region, setRegion] = useState<Region | null>(null);
  const [selected, setSelected] = useState<EntityPoint | null>(null);
  const [waving, setWaving] = useState<string | null>(null);
  const mapRef = useRef<MapView>(null);

  // ─── Viewport derivation ───────────────────────────────────────────────
  const viewport = useMemo<Viewport | null>(() => regionToViewport(region), [region]);
  const zoom = useMemo(() => (region ? approxZoomFromRegion(region) : 12), [region]);

  const { data, loading, error, refresh } = useDiscovery({ viewport, zoom });

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
    } finally {
      setWaving(null);
    }
  }, []);

  // ─── Render ────────────────────────────────────────────────────────────
  return (
    <View style={styles.root}>
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

      {selected && (
        <EntityBottomSheet
          point={selected}
          waving={waving === (selected.kind === 'user' ? selected.id : null)}
          onClose={() => setSelected(null)}
          onWave={selected.kind === 'user' ? () => onWave(selected.id) : undefined}
        />
      )}
    </View>
  );
}

// ─── Helpers ─────────────────────────────────────────────────────────────

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
  loading: {
    position: 'absolute',
    top: 60,
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
