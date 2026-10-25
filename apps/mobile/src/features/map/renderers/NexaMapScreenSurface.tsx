import React from 'react';

import type { NexaMapController } from '../contracts/mapRenderer';
import { NEXA_MAP_RENDERER_ROLLOUT } from '../mapRendererRollout';
import {
  NexaMapRuntimeSurface,
  type NexaMapRuntimeSurfaceProps,
} from './NexaMapRuntimeSurface';

export type NexaMapScreenSurfaceProps = Omit<
  NexaMapRuntimeSurfaceProps,
  'requestedRenderer' | 'mapLibreAvailable'
>;

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
    />
  );
});
