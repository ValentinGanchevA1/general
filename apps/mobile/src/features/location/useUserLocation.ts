import { useContext } from 'react';

import {
  UserLocationContext,
  type UserLocationContextValue,
} from './UserLocationContext';

export type { LocationPermissionStatus } from './locationPermissionState';

/**
 * Reads the app-level location source of truth. Native permission/GPS lifecycle
 * is owned by UserLocationProvider so multiple map/pulse/marketplace consumers
 * never create duplicate watchers or diverging permission state.
 */
export function useUserLocation(): UserLocationContextValue {
  return useContext(UserLocationContext);
}
