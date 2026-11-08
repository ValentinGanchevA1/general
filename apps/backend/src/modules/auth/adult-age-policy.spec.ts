import { isAtLeast18, isValidBirthDate } from './adult-age-policy';

describe('NEXUS whole-Social 18+ eligibility helper (UTC)', () => {
  const today = new Date('2026-11-08T23:59:59.000Z');

  it('accepts an exact 18th birthday and rejects one day younger', () => {
    expect(isAtLeast18('2008-11-08', today)).toBe(true);
    expect(isAtLeast18('2008-11-09', today)).toBe(false);
  });

  it('does not admit missing, future, malformed or impossible dates', () => {
    for (const dob of [undefined, null, '', '2020-99-99', '2008-02-30', '2008-11-08T00:00:00Z', '2027-01-01']) {
      expect(isAtLeast18(dob, today)).toBe(false);
    }
    expect(isValidBirthDate('2008-02-29', today)).toBe(true);
    expect(isValidBirthDate('2008-02-30', today)).toBe(false);
  });

  it('conservatively treats leap-day DOB as 18 on March 1 in a non-leap year', () => {
    expect(isAtLeast18('2008-02-29', new Date('2026-02-28T12:00:00Z'))).toBe(false);
    expect(isAtLeast18('2008-02-29', new Date('2026-03-01T00:00:00Z'))).toBe(true);
  });

  it('does not depend on the server local timezone for date-only values', () => {
    expect(isAtLeast18('2008-11-08', new Date('2026-11-08T00:00:00Z'))).toBe(true);
    expect(isAtLeast18('2008-11-09', new Date('2026-11-08T23:59:59Z'))).toBe(false);
  });
});
