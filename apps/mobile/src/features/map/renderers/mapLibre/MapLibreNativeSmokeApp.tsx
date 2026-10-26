import React from 'react';
import { StyleSheet, View } from 'react-native';
import type { DiscoveryPoint } from '@g88/shared';
import type { StyleSpecification } from '@maplibre/maplibre-react-native';
import ReactNativeBlobUtil from 'react-native-blob-util';

import { Config } from '@/config';
import { NEXA_MAP_RENDERER_ROLLOUT } from '../../mapRendererRollout';
import { resolveMapLibreStyleRuntime } from '../../mapLibreStyleRuntime';
import { NexaMapRuntimeSurface } from '../NexaMapRuntimeSurface';

const READY_MARKER_FILENAME = 'maplibre-smoke-ready';
const USE_PROVIDER_STYLE =
  (process.env.NEXA_MAPLIBRE_SMOKE_STYLE as string | undefined) === 'provider';
const SMOKE_STYLE: StyleSpecification = {
  version: 8,
  name: 'NEXA MapLibre runtime smoke',
  sources: {},
  layers: [
    {
      id: 'background',
      type: 'background',
      paint: {
        'background-color': '#0B0D12',
      },
    },
  ],
};

const SMOKE_POINTS: DiscoveryPoint[] = [
  {
    kind: 'cluster',
    cellId: 'smoke-cluster',
    lat: 0.018,
    lng: 0.018,
    count: 4,
    by: { user: 2, event: 1, listing: 1 },
  },
  {
    kind: 'user',
    id: 'smoke-user',
    lat: 0,
    lng: 0,
    meta: {
      displayName: 'Smoke User',
      avatarUrl: null,
      verification: 'id',
      online: true,
      lastSeenAt: null,
    },
  },
  {
    kind: 'event',
    id: 'smoke-event',
    lat: 0.012,
    lng: -0.012,
    meta: {
      title: 'Smoke Event',
      coverUrl: null,
      startsAt: '2030-01-01T12:00:00.000Z',
      attendeeCount: 12,
      capacity: 50,
    },
  },
  {
    kind: 'listing',
    id: 'smoke-listing',
    lat: -0.012,
    lng: 0.012,
    meta: {
      title: 'Smoke Listing',
      thumbnailUrl: null,
      priceCents: 2500,
      currency: 'EUR',
      category: 'smoke',
      mode: 'sell',
    },
  },
];

const PROVIDER_RUNTIME = resolveMapLibreStyleRuntime({
  apiKey: Config.MAPTILER_API_KEY,
  mapId: Config.MAPTILER_MAP_ID,
  region: Config.MAPTILER_REGION,
});

/**
 * CI-only runtime-router smoke app. It validates the production provider config
 * gate, then renders through NexaMapRuntimeSurface. Pull-request CI stays
 * deterministic/offline; the manual canary may opt into the real provider style.
 * The production App.tsx/navigation path is never involved.
 */
export function MapLibreNativeSmokeApp(): React.JSX.Element {
  const handleReady = React.useCallback((): void => {
    const markerPath = `${ReactNativeBlobUtil.fs.dirs.DocumentDir}/${READY_MARKER_FILENAME}`;
    void ReactNativeBlobUtil.fs.writeFile(markerPath, 'ready\n', 'utf8');
  }, []);

  if (PROVIDER_RUNTIME.status !== 'ready') {
    throw new Error('[maplibre-smoke] provider config gate is not ready');
  }

  if (
    NEXA_MAP_RENDERER_ROLLOUT.requestedRenderer !== 'maplibre' ||
    !NEXA_MAP_RENDERER_ROLLOUT.mapLibreAvailable
  ) {
    throw new Error(
      '[maplibre-smoke] build-time MapLibre renderer opt-in is not active',
    );
  }

  const mapLibreStyle = USE_PROVIDER_STYLE
    ? PROVIDER_RUNTIME.styleUrl
    : SMOKE_STYLE;

  return (
    <View style={styles.root}>
      <NexaMapRuntimeSurface
        requestedRenderer={NEXA_MAP_RENDERER_ROLLOUT.requestedRenderer}
        mapLibreAvailable={NEXA_MAP_RENDERER_ROLLOUT.mapLibreAvailable}
        mapLibreStyle={mapLibreStyle}
        points={SMOKE_POINTS}
        selectedEntityKey="user:smoke-user"
        dimUnselected
        mode="dark"
        scheme="dark"
        onReady={handleReady}
        onRegionChangeComplete={() => {}}
        onLongPress={() => {}}
        onClusterPress={() => {}}
        onEntityPress={() => {}}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
});
