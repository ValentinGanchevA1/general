import {
  NEXA_MOTION_MS,
  NEXA_MOTION_SCALE,
  resolveNexaMotionDuration,
} from './nexaMotion';

describe('NEXA motion foundation', () => {
  it('keeps the canonical timing ladder ordered', () => {
    expect(NEXA_MOTION_MS.immediate).toBeLessThan(NEXA_MOTION_MS.standard);
    expect(NEXA_MOTION_MS.standard).toBeLessThan(NEXA_MOTION_MS.sheet);
    expect(NEXA_MOTION_MS.sheet).toBeLessThan(NEXA_MOTION_MS.map);
    expect(NEXA_MOTION_MS.map).toBeLessThanOrEqual(NEXA_MOTION_MS.celebration);
  });

  it('uses a restrained press scale', () => {
    expect(NEXA_MOTION_SCALE.press).toBeGreaterThanOrEqual(0.97);
    expect(NEXA_MOTION_SCALE.press).toBeLessThan(1);
  });

  it('caps reduced-motion crossfades and can skip decorative motion', () => {
    expect(resolveNexaMotionDuration('celebration', true)).toBe(120);
    expect(resolveNexaMotionDuration('map', true, 'skip')).toBe(0);
    expect(resolveNexaMotionDuration('map', false)).toBe(NEXA_MOTION_MS.map);
  });
});
