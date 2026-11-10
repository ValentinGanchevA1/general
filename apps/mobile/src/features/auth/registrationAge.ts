/**
 * UI guard only. A self-declared DOB is NOT identity verification.
 * Backend rejects underage registration and validates DOB authoritatively.
 * Keep calendar arithmetic aligned with backend assertAdultDateOfBirth (UTC).
 */
export function registrationBirthDateError(
  dateOfBirth: string,
  now: Date = new Date(),
): string | null {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(dateOfBirth)) {
    return 'Choose your date of birth';
  }

  const parsed = new Date(`${dateOfBirth}T00:00:00.000Z`);
  if (Number.isNaN(parsed.getTime()) || parsed.toISOString().slice(0, 10) !== dateOfBirth) {
    return 'Select a valid date of birth';
  }

  const currentYear = now.getUTCFullYear();
  const birthYear = parsed.getUTCFullYear();
  const monthDelta = now.getUTCMonth() - parsed.getUTCMonth();
  const birthdayPassed = monthDelta > 0
    || (monthDelta === 0 && now.getUTCDate() >= parsed.getUTCDate());
  const age = currentYear - birthYear - (birthdayPassed ? 0 : 1);
  return age >= 18 ? null : 'You must be at least 18 years old';
}
