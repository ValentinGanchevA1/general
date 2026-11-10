import { registrationBirthDateError } from './registrationAge';

const onBoundary = new Date('2026-11-10T12:00:00.000Z');

describe('NEXUS 18+ email registration DOB (client hint, server authoritative)', () => {
  it('rejects missing or malformed date before a network request', () => {
    expect(registrationBirthDateError('', onBoundary)).toBe('Choose your date of birth');
    expect(registrationBirthDateError('10/11/2008', onBoundary)).toBe('Choose your date of birth');
    expect(registrationBirthDateError('2008-02-30', onBoundary)).toBe('Select a valid date of birth');
  });

  it('uses UTC calendar age: exactly 18 is eligible; day before is not', () => {
    expect(registrationBirthDateError('2008-11-10', onBoundary)).toBeNull();
    expect(registrationBirthDateError('2008-11-11', onBoundary)).toBe('You must be at least 18 years old');
    expect(registrationBirthDateError('2000-01-01', onBoundary)).toBeNull();
  });

  it('rejects under-18 and future dates without changing login behavior', () => {
    expect(registrationBirthDateError('2015-01-01', onBoundary)).toBe('You must be at least 18 years old');
    expect(registrationBirthDateError('2050-01-01', onBoundary)).toBe('You must be at least 18 years old');
  });

  it('handles leap years without silently accepting nonexistent birthdays', () => {
    expect(registrationBirthDateError('2008-02-29', new Date('2026-02-28T23:59:00Z')))
      .toBe('You must be at least 18 years old');
    expect(registrationBirthDateError('2008-02-29', new Date('2026-03-01T00:00:00Z')))
      .toBeNull(); // Match the backend's month/day arithmetic for leap-day birthdays.
    expect(registrationBirthDateError('2007-02-29', onBoundary))
      .toBe('Select a valid date of birth');
  });
});
