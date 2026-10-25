import React from 'react';
import type MapView from 'react-native-maps';

import { NEXA_MAP_RENDERER_ROLLOUT } from '../mapRendererRollout';
import {
  NexaMapRuntimeSurface,
  type NexaMapRuntimeSurfaceProps,
} from './NexaMapRuntimeSurface';

export type NexaMapScreenSurfaceProps = Omit<
  NexaMapRuntimeSurfaceProps,
  'requestedRenderer' | 'mapLibreAvailable'
>;

/**
 * Product-facing map surface used by MapScreen.
 *
 * Renderer rollout policy is intentionally owned here instead of MapScreen so
 * product UI cannot accidentally couple itself to a concrete map SDK or infer
 * native renderer availability. The current policy resolves to the legacy
 * implementation with no visual or interaction changes.
 */
export const NexaMapScreenSurface = React.forwardRef<
  MapView,
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
