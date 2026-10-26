import React from 'react';
import { StyleSheet, View } from 'react-native';
import type { DiscoveryPoint } from '@g88/shared';
import type { StyleSpecification } from '@maplibre/maplibre-react-native';
import ReactNativeBlobUtil from 'react-native-blob-util';

import { NEXA_MAP_RENDERER_ROLLOUT } from '../../mapRendererRollout';
import { MapLibreMapSurface } from './MapLibreMapSurface';

const READY_MARKER_FILENAME = 'maplibre-smoke-ready';
const SMOKE_STYLE: StyleSpecification = {
  version: 8,
  name: 'NEXA MapLibre renderer smoke',
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

const SMOKE_POINTS: readonly DiscoveryPoint[] = [
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

/**
 * CI-only NEXA renderer smoke app. It is bundled through a separate ENTRY_FILE
 * and is never reachable from the production App.tsx/navigation path.
 */
export function MapLibreNativeSmokeApp(): React.JSX.Element {
  const handleReady = React.useCallback((): void => {
    const markerPath = `${ReactNativeBlobUtil.fs.dirs.DocumentDir}/${READY_MARKER_FILENAME}`;
    void ReactNativeBlobUtil.fs.writeFile(markerPath, 'ready\n', 'utf8');
  }, []);

  if (
    NEXA_MAP_RENDERER_ROLLOUT.requestedRenderer !== 'maplibre' ||
    !NEXA_MAP_RENDERER_ROLLOUT.mapLibreAvailable
  ) {
    throw new Error(
      '[maplibre-smoke] build-time MapLibre renderer opt-in is not active',
    );
  }

  return (
    <View style={styles.root}>
      <MapLibreMapSurface
        mapStyle={SMOKE_STYLE}
        points={SMOKE_POINTS}
        selectedKey="user:smoke-user"
        dimUnselected
        onReady={handleReady}
        onPointPress={() => {}}
        onViewportSettled={() => {}}
        onLongPress={() => {}}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
});
