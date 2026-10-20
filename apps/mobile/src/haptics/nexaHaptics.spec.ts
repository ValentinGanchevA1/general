import {
  canEmitNexaHaptic,
  resolveNexaHapticPattern,
} from './nexaHaptics';

describe('NEXA haptics foundation', () => {
  it('keeps iOS silent until a native haptic driver exists', () => {
    expect(resolveNexaHapticPattern('select', 'ios')).toBeNull();
    expect(resolveNexaHapticPattern('success', 'other')).toBeNull();
  });

  it('maps Android intents to restrained feedback patterns', () => {
    expect(resolveNexaHapticPattern('select', 'android')).toBe(8);
    expect(resolveNexaHapticPattern('discover', 'android')).toBe(12);
    expect(resolveNexaHapticPattern('success', 'android')).toEqual([0, 16, 48, 22]);
  });

  it('throttles high-frequency selection feedback', () => {
    expect(canEmitNexaHaptic('select', 1_000, undefined)).toBe(true);
    expect(canEmitNexaHaptic('select', 1_040, 1_000)).toBe(false);
    expect(canEmitNexaHaptic('select', 1_100, 1_000)).toBe(true);
  });
});
