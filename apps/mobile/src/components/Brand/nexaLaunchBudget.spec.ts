import { NEXA_MAP_SURFACE_READY_FAIL_OPEN_MS } from './nexaLaunchReadiness';
import { NEXA_LAUNCH_TIMING_MS } from './nexaLaunchTiming';
import { LAUNCH_MOTION_PREFERENCE_TIMEOUT_MS } from './resolveLaunchReduceMotion';

describe('NEXA launch performance budget', () => {
  it('keeps the last entrance trigger within the branded launch budget', () => {
    const lastEntranceTriggerMs = Math.max(...Object.values(NEXA_LAUNCH_TIMING_MS));

    expect(lastEntranceTriggerMs).toBeLessThanOrEqual(700);
  });

  it('fails open MapView readiness quickly enough to avoid a blocked launch', () => {
    expect(NEXA_MAP_SURFACE_READY_FAIL_OPEN_MS).toBeLessThanOrEqual(650);
  });

  it('fails open Reduce Motion preference lookup without stalling entrance', () => {
    expect(LAUNCH_MOTION_PREFERENCE_TIMEOUT_MS).toBeLessThanOrEqual(250);
  });
});
