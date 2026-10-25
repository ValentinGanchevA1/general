export type LocationPermissionStatus = 'unknown' | 'granted' | 'denied';

/**
 * A quiet Android permission check cannot distinguish "never asked" from a
 * previous denial. Treat only a positive check as authoritative; an explicit
 * permission request is responsible for transitioning to `denied`.
 */
export function statusFromAndroidPermissionCheck(
  granted: boolean,
): LocationPermissionStatus {
  return granted ? 'granted' : 'unknown';
}

/**
 * Automatic screen-focus requests must never reopen native permission UI after
 * an explicit denial. Only a user-triggered recovery action may retry.
 */
export function shouldRequestLocationPermission(
  status: LocationPermissionStatus,
  explicitRetry: boolean,
): boolean {
  if (status === 'granted') return false;
  if (status === 'denied') return explicitRetry;
  return true;
}
