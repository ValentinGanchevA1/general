import { NEXA_MAP_SURFACE_READY_FAIL_OPEN_MS } from './nexaLaunchReadiness';
import { NEXA_LAUNCH_TIMING_MS as T } from './nexaLaunchTiming';
import { LAUNCH_MOTION_PREFERENCE_TIMEOUT_MS } from './resolveLaunchReduceMotion';

describe('NEXA launch performance budget', () => {
  it('keeps the complete entrance within the branded launch budget', () => {
    expect(T.entranceComplete).toBeLessThanOrEqual(1100);
  });

  it('originates the branded motion at the pupil', () => {
    expect(T.pupilIgnition).toBeLessThan(T.eyeDrawStart);
  });

  it('builds the eye before energy propagates into the network', () => {
    expect(T.eyeComplete).toBeLessThanOrEqual(T.orbitDrawStart);
  });

  it('activates network nodes in propagation order', () => {
    expect(T.node1).toBeLessThan(T.node2);
    expect(T.node2).toBeLessThan(T.node3);
    expect(T.node3).toBeLessThan(T.node4);
  });

  it('converges before resolving the wordmark', () => {
    expect(T.convergencePeak).toBeLessThan(T.wordmarkReveal);
  });

  it('fails open MapView readiness quickly enough to avoid a blocked launch', () => {
    expect(NEXA_MAP_SURFACE_READY_FAIL_OPEN_MS).toBeLessThanOrEqual(650);
  });

  it('fails open Reduce Motion preference lookup without stalling entrance', () => {
    expect(LAUNCH_MOTION_PREFERENCE_TIMEOUT_MS).toBeLessThanOrEqual(250);
  });
});
