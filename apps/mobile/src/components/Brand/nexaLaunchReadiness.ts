export const NEXA_MAP_SURFACE_READY_FAIL_OPEN_MS = 650;

export interface NexaLaunchReadinessInput {
  restoring: boolean;
  requiresMapSurface: boolean;
  mapSurfaceReady: boolean;
  mapSurfaceWaitExpired: boolean;
}

export interface NexaSpatialHandoffReadinessInput {
  requiresMapSurface: boolean;
  mapSurfaceReady: boolean;
}

/**
 * The launch overlay must never expose a cold MapView when the authenticated
 * destination is Map, but it must also never block indefinitely on Google Maps.
 * Auth/profile destinations do not require map readiness.
 */
export function resolveNexaLaunchReady({
  restoring,
  requiresMapSurface,
  mapSurfaceReady,
  mapSurfaceWaitExpired,
}: NexaLaunchReadinessInput): boolean {
  if (restoring) return false;
  if (!requiresMapSurface) return true;
  return mapSurfaceReady || mapSurfaceWaitExpired;
}

/**
 * The decorative spatial handoff only makes sense over a native map surface that
 * actually became ready. A bounded launch fail-open may expose the app before
 * that happens; in that path, skip the handoff instead of implying readiness.
 */
export function shouldPlayNexaSpatialHandoff({
  requiresMapSurface,
  mapSurfaceReady,
}: NexaSpatialHandoffReadinessInput): boolean {
  return requiresMapSurface && mapSurfaceReady;
}
