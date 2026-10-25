import {
  launchTime,
  NEXA_LAUNCH_TIMING_MS,
} from './nexaLaunchTiming';

const T = NEXA_LAUNCH_TIMING_MS;

describe('NEXA launch timing', () => {
  it('starts from the pupil before constructing the eye', () => {
    expect(T.pupilIgnition).toBeLessThan(T.eyeDrawStart);
    expect(T.eyeDrawStart).toBeLessThan(T.irisDrawStart);
    expect(T.irisDrawStart).toBeLessThan(T.lowerLidDrawStart);
    expect(T.lowerLidDrawStart).toBeLessThan(T.eyeComplete);
  });

  it('builds the eye before propagating into the orbit', () => {
    expect(T.eyeComplete).toBeLessThanOrEqual(T.orbitDrawStart);
    expect(T.orbitDrawStart).toBeLessThan(T.orbitComplete);
  });

  it('activates network nodes in propagation order', () => {
    expect(T.node1).toBeLessThan(T.node2);
    expect(T.node2).toBeLessThan(T.node3);
    expect(T.node3).toBeLessThan(T.node4);
  });

  it('converges once before revealing the wordmark', () => {
    expect(T.convergenceStart).toBeLessThan(T.convergencePeak);
    expect(T.convergencePeak).toBeLessThan(T.convergenceEnd);
    expect(T.convergenceEnd).toBeLessThan(T.wordmarkReveal);
    expect(T.wordmarkReveal).toBeLessThan(T.wordmarkComplete);
  });

  it('keeps the full entrance inside the launch budget', () => {
    expect(T.wordmarkComplete).toBeLessThan(T.entranceComplete);
    expect(T.entranceComplete).toBeLessThanOrEqual(1100);
  });

  it('normalizes launch milliseconds against entrance completion', () => {
    expect(launchTime(0)).toBe(0);
    expect(launchTime(T.entranceComplete)).toBe(1);
  });
});
