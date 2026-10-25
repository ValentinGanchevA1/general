import type { DiscoveryPointKey } from '@g88/shared';

import type { MapCoordinate } from './mapRenderer';

export type MapInteractionState =
  | { type: 'idle' }
  | { type: 'selected'; key: DiscoveryPointKey }
  | { type: 'peek'; key: DiscoveryPointKey }
  | { type: 'detail'; key: DiscoveryPointKey }
  | { type: 'creating'; coordinate: MapCoordinate };

export type MapInteractionEvent =
  | { type: 'SELECT'; key: DiscoveryPointKey }
  | { type: 'OPEN_PEEK'; key: DiscoveryPointKey }
  | { type: 'OPEN_DETAIL'; key: DiscoveryPointKey }
  | { type: 'START_CREATE'; coordinate: MapCoordinate }
  | { type: 'BACK' }
  | { type: 'CLOSE' };

export const initialMapInteractionState: MapInteractionState = { type: 'idle' };

/**
 * Single source of truth for mutually-exclusive map interaction surfaces.
 * This prevents impossible combinations such as detail + create or two active
 * selections while keeping renderer-specific animation state out of Redux.
 */
export function reduceMapInteraction(
  state: MapInteractionState,
  event: MapInteractionEvent,
): MapInteractionState {
  switch (event.type) {
    case 'SELECT':
      return { type: 'selected', key: event.key };
    case 'OPEN_PEEK':
      return { type: 'peek', key: event.key };
    case 'OPEN_DETAIL':
      return { type: 'detail', key: event.key };
    case 'START_CREATE':
      return { type: 'creating', coordinate: event.coordinate };
    case 'CLOSE':
      return initialMapInteractionState;
    case 'BACK':
      if (state.type === 'detail') return { type: 'peek', key: state.key };
      if (state.type === 'peek') return { type: 'selected', key: state.key };
      return initialMapInteractionState;
    default:
      return assertNever(event);
  }
}

export function selectedMapPointKey(
  state: MapInteractionState,
): DiscoveryPointKey | null {
  switch (state.type) {
    case 'selected':
    case 'peek':
    case 'detail':
      return state.key;
    case 'idle':
    case 'creating':
      return null;
    default:
      return assertNever(state);
  }
}

function assertNever(value: never): never {
  throw new Error(`Unhandled map interaction variant: ${JSON.stringify(value)}`);
}
