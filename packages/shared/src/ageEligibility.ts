/**
 * NEXUS launch eligibility is adult-only (18+ across all Social features).
 * This function validates an explicitly entered calendar date, not an age
 * verified by a government ID or Google identity provider.
 */
export const NEXUS_MINIMUM_AGE = 18 as const;

export function isAdultDateOfBirth(value: string, now: Date = new Date()): boolean {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
  if (!match) return false;
  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  const parsed = new Date(Date.UTC(year, month - 1, day));
  if (parsed.getUTCFullYear() !== year
    || parsed.getUTCMonth() !== month - 1
    || parsed.getUTCDate() !== day) return false;

  const thisYear = now.getUTCFullYear();
  const thisMonth = now.getUTCMonth() + 1;
  const thisDay = now.getUTCDate();
  const age = thisYear - year - (
    thisMonth < month || (thisMonth === month && thisDay < day) ? 1 : 0
  );
  return age >= NEXUS_MINIMUM_AGE && age <= 120;
}

export type AdultAgeStatusReason = 'missing' | 'underage' | null;
export interface AdultAgeStatus {
  enforced: boolean;
  eligible: boolean;
  reason: AdultAgeStatusReason;
}
