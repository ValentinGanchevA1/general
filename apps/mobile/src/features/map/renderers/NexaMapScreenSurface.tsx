import React from 'react';

import { Config } from '@/config';
import { useAppSelector } from '@/hooks/redux';
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
  'requestedRenderer' | 'mapLibreAvailable' | 'mapLibreStyle'
>;

const MAPLIBRE_STYLE_RUNTIME = resolveMapLibreStyleRuntime({
  apiKey: Config.MAPTILER_API_KEY,
  mapId: Config.MAPTILER_MAP_ID,
  region: Config.MAPTILER_REGION,
});

/** Product-facing map surface used by MapScreen. */
export const NexaMapScreenSurface = React.forwardRef<
  NexaMapController,
  NexaMapScreenSurfaceProps
>(function NexaMapScreenSurface(props, ref): React.JSX.Element {
  useMapRendererPolicyLifecycle();

  const mapLibreEnabled = useAppSelector(
    (state) => state.mapRendererPolicy.mapLibreEnabled,
  );
  const validUntilMs = useAppSelector(
    (state) => state.mapRendererPolicy.validUntilMs,
  );
  const remoteMapLibreEnabled =
    mapLibreEnabled && validUntilMs > Date.now();
  const requestedRenderer = resolveRemoteMapRendererRequest(
    NEXA_MAP_RENDERER_ROLLOUT.requestedRenderer,
    remoteMapLibreEnabled,
  );

  return (
    <NexaMapRuntimeSurface
      ref={ref}
      {...props}
      requestedRenderer={requestedRenderer}
      mapLibreAvailable={NEXA_MAP_RENDERER_ROLLOUT.mapLibreAvailable}
      mapLibreStyle={
        MAPLIBRE_STYLE_RUNTIME.status === 'ready'
          ? MAPLIBRE_STYLE_RUNTIME.styleUrl
          : null
      }
    />
  );
});
