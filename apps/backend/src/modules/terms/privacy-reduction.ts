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
