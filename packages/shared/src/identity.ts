/** Profile identity enums for dating match (v1 — no ethnicity). */

export type Gender =
  | 'woman'
  | 'man'
  | 'non_binary'
  | 'self_describe';

export type SexualOrientation =
  | 'straight'
  | 'gay'
  | 'lesbian'
  | 'bisexual'
  | 'pansexual'
  | 'asexual'
  | 'queer'
  | 'self_describe';

export const GENDERS: readonly Gender[] = [
  'woman',
  'man',
  'non_binary',
  'self_describe',
] as const;

export const SEXUAL_ORIENTATIONS: readonly SexualOrientation[] = [
  'straight',
  'gay',
  'lesbian',
  'bisexual',
  'pansexual',
  'asexual',
  'queer',
  'self_describe',
] as const;

export const GENDER_LABELS: Record<Gender, string> = {
  woman: 'Woman',
  man: 'Man',
  non_binary: 'Non-binary',
  self_describe: 'Self-describe',
};

export const ORIENTATION_LABELS: Record<SexualOrientation, string> = {
  straight: 'Straight',
  gay: 'Gay',
  lesbian: 'Lesbian',
  bisexual: 'Bisexual',
  pansexual: 'Pansexual',
  asexual: 'Asexual',
  queer: 'Queer',
  self_describe: 'Self-describe',
};

export function isGender(v: unknown): v is Gender {
  return typeof v === 'string' && (GENDERS as readonly string[]).includes(v);
}

export function isSexualOrientation(v: unknown): v is SexualOrientation {
  return typeof v === 'string' && (SEXUAL_ORIENTATIONS as readonly string[]).includes(v);
}

/** Max length for free-text self-describe fields. */
export const SELF_DESCRIBE_MAX = 40;

/** Public label for gender (respects self-describe). Null when unset. */
export function genderDisplayLabel(
  gender: Gender | null | undefined,
  selfDescribe?: string | null,
): string | null {
  if (gender == null) return null;
  if (gender === 'self_describe') {
    const s = selfDescribe?.trim();
    return s && s.length > 0 ? s : GENDER_LABELS.self_describe;
  }
  return GENDER_LABELS[gender];
}

/** Public label for orientation (respects self-describe). Null when unset. */
export function orientationDisplayLabel(
  orientation: SexualOrientation | null | undefined,
  selfDescribe?: string | null,
): string | null {
  if (orientation == null) return null;
  if (orientation === 'self_describe') {
    const s = selfDescribe?.trim();
    return s && s.length > 0 ? s : ORIENTATION_LABELS.self_describe;
  }
  return ORIENTATION_LABELS[orientation];
}

/**
 * Compact public identity chips for profile hero / sheet subtitle.
 * Only pass fields already gated by show_* on the server.
 */
export function formatPublicIdentityParts(opts: {
  gender?: Gender | null;
  genderSelfDescribe?: string | null;
  sexualOrientation?: SexualOrientation | null;
  orientationSelfDescribe?: string | null;
  nationality?: string | null;
}): string[] {
  const parts: string[] = [];
  const g = genderDisplayLabel(opts.gender, opts.genderSelfDescribe);
  if (g) parts.push(g);
  const o = orientationDisplayLabel(opts.sexualOrientation, opts.orientationSelfDescribe);
  if (o) parts.push(o);
  const n = opts.nationality?.trim();
  if (n) parts.push(n);
  return parts;
}
