import {
  canEmitNexaHaptic,
  resolveNexaHapticPattern,
  shouldEmitNexaHaptic,
} from './nexaHaptics';

describe('NEXA haptics v2', () => {
  it('keeps iOS silent until a native haptic driver exists', () => {
    expect(resolveNexaHapticPattern('select', 'ios')).toBeNull();
    expect(resolveNexaHapticPattern('success', 'other')).toBeNull();
  });

  it('maps Android intents to restrained semantic feedback patterns', () => {
    expect(resolveNexaHapticPattern('select', 'android')).toBe(8);
    expect(resolveNexaHapticPattern('discover', 'android')).toBe(12);
    expect(resolveNexaHapticPattern('commit', 'android')).toBe(18);
    expect(resolveNexaHapticPattern('success', 'android')).toEqual([0, 16, 48, 22]);
    expect(resolveNexaHapticPattern('error', 'android')).toEqual([0, 24, 46, 32]);
  });

  it('allows direct feedback only while the app is active', () => {
    expect(shouldEmitNexaHaptic('connect', 'direct', 'active')).toBe(true);
    expect(shouldEmitNexaHaptic('connect', 'direct', 'background')).toBe(false);
    expect(shouldEmitNexaHaptic('error', 'direct', 'inactive')).toBe(false);
  });

  it('keeps unsolicited realtime social arrivals tactile-silent', () => {
    expect(shouldEmitNexaHaptic('connect', 'realtime', 'active')).toBe(false);
    expect(shouldEmitNexaHaptic('discover', 'realtime', 'active')).toBe(false);
    expect(shouldEmitNexaHaptic('success', 'realtime', 'active')).toBe(true);
    expect(shouldEmitNexaHaptic('success', 'realtime', 'background')).toBe(false);
  });

  it('never vibrates for passive system state changes', () => {
    expect(shouldEmitNexaHaptic('success', 'system', 'active')).toBe(false);
    expect(shouldEmitNexaHaptic('warning', 'system', 'active')).toBe(false);
  });

  it('throttles both the intent and rapid cross-intent sequences', () => {
    expect(canEmitNexaHaptic('select', 1_000, undefined)).toBe(true);
    expect(canEmitNexaHaptic('select', 1_040, 1_000)).toBe(false);
    expect(canEmitNexaHaptic('select', 1_100, 1_000)).toBe(true);
    expect(canEmitNexaHaptic('commit', 1_040, undefined, 1_000)).toBe(false);
    expect(canEmitNexaHaptic('commit', 1_070, undefined, 1_000)).toBe(true);
  });
});
