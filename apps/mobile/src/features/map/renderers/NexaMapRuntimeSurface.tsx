import React from 'react';
import type MapView from 'react-native-maps';

import type { MapRendererKind } from '../mapRenderer';
import { resolveAvailableMapRenderer } from '../mapRendererRuntime';
import {
  LegacyMapSurface,
  type LegacyMapSurfaceProps,
} from './legacy/LegacyMapSurface';

export interface NexaMapRuntimeSurfaceProps extends LegacyMapSurfaceProps {
  requestedRenderer: MapRendererKind;
  mapLibreAvailable: boolean;
}

/**
 * Single runtime entry point for NEXA map rendering.
 *
 * The public props intentionally remain renderer-neutral at the product layer.
 * Until the MapLibre native bundle and parity surface are present, requesting
 * MapLibre resolves to the proven legacy implementation rather than risking a
 * blank map. The MapLibre branch is deliberately not imported here yet so an
 * unavailable native module can never be loaded accidentally.
 */
export const NexaMapRuntimeSurface = React.forwardRef<
  MapView,
  NexaMapRuntimeSurfaceProps
>(function NexaMapRuntimeSurface(
  { requestedRenderer, mapLibreAvailable, ...surfaceProps },
  ref,
): React.JSX.Element {
  const renderer = resolveAvailableMapRenderer({
    requested: requestedRenderer,
    mapLibreAvailable,
  });

  if (renderer === 'maplibre') {
    // The native MapLibre surface is added in the next rollout slice. Keep this
    // fail-closed until that implementation is bundled and parity-validated.
    return <LegacyMapSurface ref={ref} {...surfaceProps} />;
  }

  return <LegacyMapSurface ref={ref} {...surfaceProps} />;
});
