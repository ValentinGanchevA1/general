import { buildNexaLaunchTelemetryProps } from './nexaLaunchTelemetry';

describe('buildNexaLaunchTelemetryProps', () => {
  it('reports map launch timings without fail-open when the map is ready', () => {
    expect(
      buildNexaLaunchTelemetryProps({
        startedAtMs: 1_000,
        completedAtMs: 2_650,
        authReadyAtMs: 1_180,
        mapReadyAtMs: 1_520,
        overlayHiddenAtMs: 2_080,
        requiresMapSurface: true,
        mapSurfaceWaitExpired: false,
        reducedMotion: false,
      }),
    ).toEqual({
      path: 'map',
      totalMs: 1_650,
      authReadyMs: 180,
      mapReadyMs: 520,
      overlayHiddenMs: 1_080,
      mapReadyFailOpen: false,
      reducedMotion: false,
    });
  });

  it('marks map fail-open and preserves Reduced Motion segmentation', () => {
    expect(
      buildNexaLaunchTelemetryProps({
        startedAtMs: 10_000,
        completedAtMs: 11_900,
        authReadyAtMs: 10_300,
        mapReadyAtMs: null,
        overlayHiddenAtMs: 11_400,
        requiresMapSurface: true,
        mapSurfaceWaitExpired: true,
        reducedMotion: true,
      }),
    ).toEqual({
      path: 'map',
      totalMs: 1_900,
      authReadyMs: 300,
      mapReadyMs: null,
      overlayHiddenMs: 1_400,
      mapReadyFailOpen: true,
      reducedMotion: true,
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
        reducedMotion: null,
      }),
    ).toEqual({
      path: 'non_map',
      totalMs: 550,
      authReadyMs: 120,
      mapReadyMs: null,
      overlayHiddenMs: 550,
      mapReadyFailOpen: false,
      reducedMotion: null,
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
        reducedMotion: false,
      }),
    ).toEqual({
      path: 'non_map',
      totalMs: 0,
      authReadyMs: 0,
      mapReadyMs: null,
      overlayHiddenMs: null,
      mapReadyFailOpen: false,
      reducedMotion: false,
    });
  });
});
