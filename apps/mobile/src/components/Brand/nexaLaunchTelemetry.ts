export type NexaLaunchTelemetryPath = 'map' | 'non_map';

export interface NexaLaunchTelemetryInput {
  startedAtMs: number;
  completedAtMs: number;
  authReadyAtMs: number | null;
  mapReadyAtMs: number | null;
  overlayHiddenAtMs: number | null;
  requiresMapSurface: boolean;
  mapSurfaceWaitExpired: boolean;
  /** True when the launch used the spatial handoff branch after overlay exit. */
  spatialHandoffUsed: boolean;
  /** Exact Reduced Motion mode frozen by the branded launch resolver. */
  reducedMotion: boolean | null;
}

export interface NexaLaunchTelemetryProps
  extends Record<string, string | number | boolean | null> {
  path: NexaLaunchTelemetryPath;
  totalMs: number;
  authReadyMs: number | null;
  mapReadyMs: number | null;
  overlayHiddenMs: number | null;
  mapReadyFailOpen: boolean;
  spatialHandoffUsed: boolean;
  reducedMotion: boolean | null;
}

function elapsedMs(startedAtMs: number, endedAtMs: number | null): number | null {
  if (endedAtMs === null) return null;
  return Math.max(0, Math.round(endedAtMs - startedAtMs));
}

/**
 * PII-free launch timing payload used by the existing analytics breadcrumb layer.
 * Durations are relative to AppShell mount; no absolute timestamps, identifiers,
 * coordinates, or route parameters leave the process.
 */
export function buildNexaLaunchTelemetryProps(
  input: NexaLaunchTelemetryInput,
): NexaLaunchTelemetryProps {
  return {
    path: input.requiresMapSurface ? 'map' : 'non_map',
    totalMs: elapsedMs(input.startedAtMs, input.completedAtMs) ?? 0,
    authReadyMs: elapsedMs(input.startedAtMs, input.authReadyAtMs),
    mapReadyMs: input.requiresMapSurface
      ? elapsedMs(input.startedAtMs, input.mapReadyAtMs)
      : null,
    overlayHiddenMs: elapsedMs(input.startedAtMs, input.overlayHiddenAtMs),
    mapReadyFailOpen:
      input.requiresMapSurface && input.mapSurfaceWaitExpired,
    spatialHandoffUsed:
      input.requiresMapSurface && input.spatialHandoffUsed,
    reducedMotion: input.reducedMotion,
  };
}
