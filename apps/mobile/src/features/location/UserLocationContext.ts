import { createContext } from 'react';
import type { LatLng } from '@g88/shared';

import type { LocationPermissionStatus } from './locationPermissionState';

export interface GetCurrentLocationOptions {
  /** True only for a direct user action that may present native permission UI. */
  requestPermission?: boolean;
}

export interface UserLocationContextValue {
  coords: LatLng | null;
  /** True only after an explicit denial (or native permission-denied error). */
  permissionDenied: boolean;
  permissionStatus: LocationPermissionStatus;
  /** Initial/automatic request. Does not reopen native UI after explicit denial. */
  requestPermission: () => Promise<void>;
  /** User-triggered recovery action allowed to retry after explicit denial. */
  retryPermission: () => Promise<void>;
  /**
   * Resolve the shared provider's current fix. Native geolocation access stays
   * centralized here; callers may opt into permission UI only from a direct
   * user action.
   */
  getCurrentLocation: (
    options?: GetCurrentLocationOptions,
  ) => Promise<LatLng | null>;
}

const noopRequestPermission = async (): Promise<void> => undefined;
const noopGetCurrentLocation = async (): Promise<LatLng | null> => null;

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
  getCurrentLocation: noopGetCurrentLocation,
});
