import { canUseProtosNexus, normalizeThemeMode } from '@/theme/protosNexus';

describe('PROTOS NEXUS entitlement', () => {
  it('allows only premium membership', () => {
    expect(canUseProtosNexus('premium')).toBe(true);
    expect(canUseProtosNexus('basic')).toBe(false);
    expect(canUseProtosNexus('free')).toBe(false);
    expect(canUseProtosNexus(null)).toBe(false);
  });

  it('falls back to system after a confirmed entitlement loss', () => {
    expect(normalizeThemeMode('protos-nexus', false)).toBe('system');
  });

  it('keeps PROTOS NEXUS while membership is still hydrating', () => {
    expect(normalizeThemeMode('protos-nexus', undefined)).toBe('protos-nexus');
  });

  it('keeps PROTOS NEXUS for an entitled member', () => {
    expect(normalizeThemeMode('protos-nexus', true)).toBe('protos-nexus');
  });

  it.each(['system', 'light', 'dark'] as const)('never changes standard mode %s', (mode) => {
    expect(normalizeThemeMode(mode, false)).toBe(mode);
    expect(normalizeThemeMode(mode, undefined)).toBe(mode);
  });
});
