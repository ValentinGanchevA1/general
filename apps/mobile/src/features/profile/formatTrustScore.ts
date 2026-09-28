/**
 * Soften zero trust score — "0%" reads broken on day-0 profiles.
 * Prefer an em dash over a literal zero percentage.
 */
export function formatTrustScoreLabel(
  score: number | null | undefined,
): string {
  if (score == null || !Number.isFinite(score) || score <= 0) {
    return '\u2014';
  }
  return `${Math.round(score)}%`;
}

/** Short empty-trust line under the score (no badges yet). */
export function trustEmptyCopy(): string {
  return 'Just getting started';
}
