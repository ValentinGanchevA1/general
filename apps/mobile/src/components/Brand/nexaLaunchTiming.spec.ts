import { NEXA_LAUNCH_TIMING_MS } from './nexaLaunchTiming';

describe('NEXA launch timing', () => {
  it('ignites rays before revealing the eye core', () => {
    expect(NEXA_LAUNCH_TIMING_MS.rayIgnitionDelay).toBeLessThan(
      NEXA_LAUNCH_TIMING_MS.eyeRevealDelay,
    );
  });

  it('reveals the brand hierarchy from eye to orbit to entities to wordmark', () => {
    expect(NEXA_LAUNCH_TIMING_MS.eyeRevealDelay).toBeLessThan(
      NEXA_LAUNCH_TIMING_MS.orbitRevealDelay,
    );
    expect(NEXA_LAUNCH_TIMING_MS.orbitRevealDelay).toBeLessThan(
      NEXA_LAUNCH_TIMING_MS.entityRevealDelay,
    );
    expect(NEXA_LAUNCH_TIMING_MS.entityRevealDelay).toBeLessThan(
      NEXA_LAUNCH_TIMING_MS.wordmarkRevealDelay,
    );
  });

  it('keeps the ray-to-eye lead perceptible but brief', () => {
    const lead =
      NEXA_LAUNCH_TIMING_MS.eyeRevealDelay -
      NEXA_LAUNCH_TIMING_MS.rayIgnitionDelay;

    expect(lead).toBeGreaterThanOrEqual(40);
    expect(lead).toBeLessThanOrEqual(100);
  });
});
