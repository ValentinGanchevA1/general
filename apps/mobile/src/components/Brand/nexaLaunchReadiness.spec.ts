import {
  NEXA_MAP_SURFACE_READY_FAIL_OPEN_MS,
  resolveNexaLaunchReady,
} from './nexaLaunchReadiness';

describe('resolveNexaLaunchReady', () => {
  it('never exits while boot-time auth restoration is active', () => {
    expect(
      resolveNexaLaunchReady({
        restoring: true,
        requiresMapSurface: false,
        mapSurfaceReady: true,
        mapSurfaceWaitExpired: true,
      }),
    ).toBe(false);
  });

  it('does not wait for MapView when the launch destination is auth/profile setup', () => {
    expect(
      resolveNexaLaunchReady({
        restoring: false,
        requiresMapSurface: false,
        mapSurfaceReady: false,
        mapSurfaceWaitExpired: false,
      }),
    ).toBe(true);
  });

  it('allows the map launch to dissolve when the native map surface is ready', () => {
    expect(
      resolveNexaLaunchReady({
        restoring: false,
        requiresMapSurface: true,
        mapSurfaceReady: true,
        mapSurfaceWaitExpired: false,
      }),
    ).toBe(true);
  });

  it('fails open after the bounded map-surface wait', () => {
    expect(NEXA_MAP_SURFACE_READY_FAIL_OPEN_MS).toBeGreaterThan(0);
    expect(NEXA_MAP_SURFACE_READY_FAIL_OPEN_MS).toBeLessThanOrEqual(1000);
    expect(
      resolveNexaLaunchReady({
        restoring: false,
        requiresMapSurface: true,
        mapSurfaceReady: false,
        mapSurfaceWaitExpired: true,
      }),
    ).toBe(true);
  });

  it('holds the authenticated map launch before surface readiness or timeout', () => {
    expect(
      resolveNexaLaunchReady({
        restoring: false,
        requiresMapSurface: true,
        mapSurfaceReady: false,
        mapSurfaceWaitExpired: false,
      }),
    ).toBe(false);
  });
});
