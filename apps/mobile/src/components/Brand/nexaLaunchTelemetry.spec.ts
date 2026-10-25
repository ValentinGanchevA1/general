import { buildNexaLaunchTelemetryProps } from './nexaLaunchTelemetry';

describe('buildNexaLaunchTelemetryProps', () => {
  it('reports map launch timings, spatial handoff, and full motion when the map is ready', () => {
    expect(
      buildNexaLaunchTelemetryProps({
        startedAtMs: 1_000,
        completedAtMs: 2_650,
        authReadyAtMs: 1_180,
        mapReadyAtMs: 1_520,
        overlayHiddenAtMs: 2_080,
        requiresMapSurface: true,
        mapSurfaceWaitExpired: false,
        spatialHandoffUsed: true,
        reducedMotion: false,
        interrupted: false,
      }),
    ).toEqual({
      path: 'map',
      totalMs: 1_650,
      authReadyMs: 180,
      mapReadyMs: 520,
      overlayHiddenMs: 1_080,
      mapReadyFailOpen: false,
      spatialHandoffUsed: true,
      reducedMotion: false,
      interrupted: false,
    });
  });

  it('marks direct map fail-open separately and preserves Reduced Motion segmentation', () => {
    expect(
      buildNexaLaunchTelemetryProps({
        startedAtMs: 10_000,
        completedAtMs: 11_900,
        authReadyAtMs: 10_300,
        mapReadyAtMs: null,
        overlayHiddenAtMs: 11_400,
        requiresMapSurface: true,
        mapSurfaceWaitExpired: true,
        spatialHandoffUsed: false,
        reducedMotion: true,
        interrupted: false,
      }),
    ).toEqual({
      path: 'map',
      totalMs: 1_900,
      authReadyMs: 300,
      mapReadyMs: null,
      overlayHiddenMs: 1_400,
      mapReadyFailOpen: true,
      spatialHandoffUsed: false,
      reducedMotion: true,
      interrupted: false,
    });
  });

  it('distinguishes late map readiness after timeout when the handoff still runs', () => {
    expect(
      buildNexaLaunchTelemetryProps({
        startedAtMs: 5_000,
        completedAtMs: 6_720,
        authReadyAtMs: 5_120,
        mapReadyAtMs: 5_820,
        overlayHiddenAtMs: 6_180,
        requiresMapSurface: true,
        mapSurfaceWaitExpired: true,
        spatialHandoffUsed: true,
        reducedMotion: false,
        interrupted: false,
      }),
    ).toEqual({
      path: 'map',
      totalMs: 1_720,
      authReadyMs: 120,
      mapReadyMs: 820,
      overlayHiddenMs: 1_180,
      mapReadyFailOpen: true,
      spatialHandoffUsed: true,
      reducedMotion: false,
      interrupted: false,
    });
  });

  it('does not report map-only state for non-map launch paths', () => {
    expect(
      buildNexaLaunchTelemetryProps({
        startedAtMs: 500,
        completedAtMs: 1_050,
        authReadyAtMs: 620,
        mapReadyAtMs: 700,
        overlayHiddenAtMs: 1_050,
        requiresMapSurface: false,
        mapSurfaceWaitExpired: true,
        spatialHandoffUsed: true,
        reducedMotion: null,
        interrupted: false,
      }),
    ).toEqual({
      path: 'non_map',
      totalMs: 550,
      authReadyMs: 120,
      mapReadyMs: null,
      overlayHiddenMs: 550,
      mapReadyFailOpen: false,
      spatialHandoffUsed: false,
      reducedMotion: null,
      interrupted: false,
    });
  });

  it('preserves foreground interruption state for calibration filtering', () => {
    expect(
      buildNexaLaunchTelemetryProps({
        startedAtMs: 1_000,
        completedAtMs: 8_000,
        authReadyAtMs: 1_150,
        mapReadyAtMs: 1_400,
        overlayHiddenAtMs: 7_700,
        requiresMapSurface: true,
        mapSurfaceWaitExpired: false,
        spatialHandoffUsed: true,
        reducedMotion: false,
        interrupted: true,
      }),
    ).toMatchObject({
      path: 'map',
      totalMs: 7_000,
      interrupted: true,
    });
  });

  it('clamps clock skew instead of reporting negative durations', () => {
    expect(
      buildNexaLaunchTelemetryProps({
        startedAtMs: 2_000,
        completedAtMs: 1_900,
        authReadyAtMs: 1_950,
        mapReadyAtMs: null,
        overlayHiddenAtMs: null,
        requiresMapSurface: false,
        mapSurfaceWaitExpired: false,
        spatialHandoffUsed: false,
        reducedMotion: false,
        interrupted: false,
      }),
    ).toEqual({
      path: 'non_map',
      totalMs: 0,
      authReadyMs: 0,
      mapReadyMs: null,
      overlayHiddenMs: null,
      mapReadyFailOpen: false,
      spatialHandoffUsed: false,
      reducedMotion: false,
      interrupted: false,
    });
  });
});
