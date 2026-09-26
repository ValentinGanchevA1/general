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
