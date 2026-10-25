import { createContext } from 'react';
import type { LatLng } from '@g88/shared';

import type { LocationPermissionStatus } from './locationPermissionState';

export interface UserLocationContextValue {
  coords: LatLng | null;
  /** True only after an explicit denial (or native permission-denied error). */
  permissionDenied: boolean;
  permissionStatus: LocationPermissionStatus;
  /** Initial/automatic request. Does not reopen native UI after explicit denial. */
  requestPermission: () => Promise<void>;
  /** User-triggered recovery action allowed to retry after explicit denial. */
  retryPermission: () => Promise<void>;
}

const noopRequestPermission = async (): Promise<void> => undefined;

/**
 * Safe fallback for isolated component tests/previews. Production navigation is
 * wrapped in UserLocationProvider so runtime consumers share one native watcher.
 */
export const UserLocationContext = createContext<UserLocationContextValue>({
  coords: null,
  permissionDenied: false,
  permissionStatus: 'unknown',
  requestPermission: noopRequestPermission,
  retryPermission: noopRequestPermission,
});
