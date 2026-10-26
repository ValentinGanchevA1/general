import React from 'react';

import { Config } from '@/config';
import type { NexaMapController } from '../contracts/mapRenderer';
import { NEXA_MAP_RENDERER_ROLLOUT } from '../mapRendererRollout';
import { resolveMapLibreStyleRuntime } from '../mapLibreStyleRuntime';
import {
  NexaMapRuntimeSurface,
  type NexaMapRuntimeSurfaceProps,
} from './NexaMapRuntimeSurface';

export type NexaMapScreenSurfaceProps = Omit<
  NexaMapRuntimeSurfaceProps,
  'requestedRenderer' | 'mapLibreAvailable' | 'mapLibreStyleUrl'
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
  return (
    <NexaMapRuntimeSurface
      ref={ref}
      {...props}
      requestedRenderer={NEXA_MAP_RENDERER_ROLLOUT.requestedRenderer}
      mapLibreAvailable={NEXA_MAP_RENDERER_ROLLOUT.mapLibreAvailable}
      mapLibreStyleUrl={
        MAPLIBRE_STYLE_RUNTIME.status === 'ready'
          ? MAPLIBRE_STYLE_RUNTIME.styleUrl
          : null
      }
    />
  );
});
