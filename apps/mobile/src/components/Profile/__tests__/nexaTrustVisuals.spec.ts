import { resolveNexaTrustVisual } from '../nexaTrustVisuals';

describe('resolveNexaTrustVisual', () => {
  it('starts at basic without verified signals', () => {
    const visual = resolveNexaTrustVisual({
      emailVerified: false,
      phoneVerified: false,
      idStatus: 'none',
      socialConnected: false,
    });

    expect(visual.level).toBe('basic');
    expect(visual.identityVerified).toBe(false);
    expect(visual.completedSignals).toBe(0);
  });

  it('uses contact after email and phone are verified', () => {
    const visual = resolveNexaTrustVisual({
      emailVerified: true,
      phoneVerified: true,
      idStatus: 'none',
      socialConnected: false,
    });

    expect(visual.level).toBe('contact');
    expect(visual.label).toBe('Contact verified');
    expect(visual.completedSignals).toBe(2);
  });

  it('uses identity when government ID is verified', () => {
    const visual = resolveNexaTrustVisual({
      emailVerified: true,
      phoneVerified: true,
      idStatus: 'verified',
      socialConnected: false,
    });

    expect(visual.level).toBe('identity');
    expect(visual.identityVerified).toBe(true);
    expect(visual.label).toBe('Identity verified');
  });

  it('uses trusted only when core identity and a supporting profile are present', () => {
    const visual = resolveNexaTrustVisual({
      emailVerified: true,
      phoneVerified: true,
      idStatus: 'verified',
      socialConnected: true,
    });

    expect(visual.level).toBe('trusted');
    expect(visual.socialConnected).toBe(true);
    expect(visual.completedSignals).toBe(4);
  });

  it('does not treat a social link alone as identity verification', () => {
    const visual = resolveNexaTrustVisual({
      emailVerified: false,
      phoneVerified: false,
      idStatus: 'none',
      socialConnected: true,
    });

    expect(visual.level).toBe('basic');
    expect(visual.identityVerified).toBe(false);
  });

  it('accepts the legacy verified badge as an ID verification compatibility signal', () => {
    const visual = resolveNexaTrustVisual({
      emailVerified: true,
      phoneVerified: true,
      idStatus: 'none',
      legacyVerifiedBadge: true,
      socialConnected: false,
    });

    expect(visual.level).toBe('identity');
    expect(visual.identityVerified).toBe(true);
  });
});
