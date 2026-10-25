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
