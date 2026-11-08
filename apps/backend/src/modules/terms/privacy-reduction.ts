import { SetMetadata } from '@nestjs/common';

/**
 * Existing members must be able to reduce their public exposure even when a
 * new Terms revision is awaiting acceptance. Never let this exception expose
 * more data or mutate user-generated profile content.
 */
export const ALLOW_TERMS_PRIVACY_REDUCTION = 'terms.allow_privacy_reduction';

export const AllowPrivacyReductionWithoutTerms = (): MethodDecorator =>
  SetMetadata(ALLOW_TERMS_PRIVACY_REDUCTION, true);

const disableOnly = new Set([
  'friendsSeeOnlineStatus',
  'showAge', 'showHometown', 'showOccupation', 'showGender',
  'showOrientation', 'showNationality', 'openToDating',
]);

/** Fail closed on additional keys, increases in visibility, or malformed body. */
export function isPrivacyReductionOnly(body: unknown): boolean {
  if (!body || typeof body !== 'object' || Array.isArray(body)) return false;
  const entries = Object.entries(body as Record<string, unknown>);
  return entries.length > 0 && entries.every(([key, value]) =>
    (key === 'visibility' && value === 'private')
    || (disableOnly.has(key) && value === false)
  );
}

/**
 * A user who declines a new policy may still withdraw existing content or
 * refuse an invitation/offer without creating any new public interaction.
 * The rule is exact-one-field to prevent mixing publication with the exit.
 */
export const ALLOW_TERMS_SAFETY_EXIT = 'terms.allow_safety_exit';
export interface TermsSafetyExitRule { field: 'status'; value: 'withdrawn' | 'declined' }
export const AllowTermsSafetyExit = (rule: TermsSafetyExitRule): MethodDecorator =>
  SetMetadata(ALLOW_TERMS_SAFETY_EXIT, rule);

export function isSafeExitOnly(body: unknown, rule: TermsSafetyExitRule): boolean {
  if (!body || typeof body !== 'object' || Array.isArray(body)) return false;
  const fields = Object.entries(body as Record<string, unknown>);
  return fields.length === 1 && fields[0]?.[0] === rule.field &&
    fields[0]?.[1] === rule.value;
}
