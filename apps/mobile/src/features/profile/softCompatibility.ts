// apps/mobile/src/features/profile/softCompatibility.ts
// Honest soft score from relationship.sharedInterests only.

/**
 * Returns null when there is nothing real to show.
 * % is a transparent band from shared count — not ML.
 */
export function softCompatibilityPercent(sharedInterests: string[] | null | undefined): number | null {
  const n = sharedInterests?.length ?? 0;
  if (n < 1) return null;
  // 1 → 52, 2 → 64, 3 → 76, 4 → 88, 5+ → 99
  return Math.min(99, 40 + n * 12);
}

export function softCompatibilityLabel(sharedInterests: string[] | null | undefined): string | null {
  const pct = softCompatibilityPercent(sharedInterests);
  if (pct == null) return null;
  return `${pct}%`;
}
