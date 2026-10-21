import {
  buildNexaProfileIdentityLine,
  countVerifiedProfileSignals,
  formatNexaProfileActivitySummary,
  formatNexaProfileTrustSummary,
} from './nexaProfileIdentity';

describe('NEXA profile identity', () => {
  it('builds a compact identity line without duplicate interests', () => {
    expect(
      buildNexaProfileIdentityLine({
        hometownCity: 'Varna',
        interests: ['React Native', 'React Native', 'Cybersecurity', 'Travel'],
      }),
    ).toBe('Varna · React Native · Cybersecurity');
  });

  it('falls back to country when city is unavailable', () => {
    expect(
      buildNexaProfileIdentityLine({
        hometownCountry: 'Bulgaria',
        interests: ['Music'],
      }),
    ).toBe('Bulgaria · Music');
  });

  it('keeps verification language factual instead of turning it into a score', () => {
    const partial = { email: true, phone: false, id: true };
    expect(countVerifiedProfileSignals(partial)).toBe(2);
    expect(formatNexaProfileTrustSummary(partial)).toBe('2 of 3 verification signals completed');
    expect(formatNexaProfileTrustSummary({ email: true, phone: true, id: true })).toBe(
      'Email, phone and ID verified',
    );
  });

  it('formats activity without inventing a popularity metric', () => {
    expect(formatNexaProfileActivitySummary({ level: 4, currentStreak: 1 })).toBe(
      'Level 4 · 1 day streak',
    );
    expect(formatNexaProfileActivitySummary({ level: 4, currentStreak: 3 })).toBe(
      'Level 4 · 3 days streak',
    );
  });
});
