import React from 'react';
import { StyleSheet, View } from 'react-native';
import {
  Map,
  type StyleSpecification,
} from '@maplibre/maplibre-react-native';
import ReactNativeBlobUtil from 'react-native-blob-util';

import { NEXA_MAP_RENDERER_ROLLOUT } from '../../mapRendererRollout';

const READY_MARKER_FILENAME = 'maplibre-smoke-ready';
const SMOKE_STYLE: StyleSpecification = {
  version: 8,
  name: 'NEXA MapLibre native smoke',
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

/**
 * CI-only native smoke app. It is bundled through a separate ENTRY_FILE and is
 * never reachable from the production App.tsx/navigation path.
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
      <Map
        mapStyle={SMOKE_STYLE}
        style={StyleSheet.absoluteFill}
        attribution={false}
        logo={false}
        compass={false}
        onDidFinishLoadingMap={handleReady}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
});
