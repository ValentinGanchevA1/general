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
 * Foreground refresh can detect a settings change without losing the distinction
 * between "never asked" and "explicitly denied". Revoking a previously granted
 * permission becomes denied; an untouched unknown state stays unknown.
 */
export function statusFromAndroidForegroundCheck(
  granted: boolean,
  previous: LocationPermissionStatus,
): LocationPermissionStatus {
  if (granted) return 'granted';
  if (previous === 'granted') return 'denied';
  return previous;
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
