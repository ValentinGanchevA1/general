// First-release Social age policy. A declared DOB is not independent age proof.
// Keep the policy disabled until all OAuth/session/realtime and safe-exit gates exist.
export function requiresAdultSocialAccess(): boolean {
  return process.env.NEXUS_REQUIRE_ADULT_AGE === 'true';
}

/** Accept only real YYYY-MM-DD calendar birth dates, never timestamps. */
export function isValidBirthDate(value: unknown, today = new Date()): value is string {
  if (typeof value !== 'string' || !/^\d{4}-(0[1-9]|1[0-2])-(0[1-9]|[12]\d|3[01])$/.test(value)) {
    return false;
  }
  const parsed = new Date(`${value}T00:00:00.000Z`);
  if (Number.isNaN(parsed.getTime()) || parsed.toISOString().slice(0, 10) !== value) {
    return false;
  }
  return value <= today.toISOString().slice(0, 10);
}

/** Full years as of the server UTC date; Feb 29 DOB turns 18 on Mar 1 in non-leap years. */
export function isAtLeast18(value: unknown, today = new Date()): boolean {
  if (!isValidBirthDate(value, today)) return false;
  const date18YearsAgo = new Date(Date.UTC(
    today.getUTCFullYear() - 18,
    today.getUTCMonth(),
    today.getUTCDate(),
  ));
  return value <= date18YearsAgo.toISOString().slice(0, 10);
}
