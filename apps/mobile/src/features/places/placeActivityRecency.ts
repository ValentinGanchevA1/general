const FIVE_MINUTES_MS = 5 * 60 * 1000;
const THIRTY_MINUTES_MS = 30 * 60 * 1000;
const TWO_HOURS_MS = 2 * 60 * 60 * 1000;

/**
 * Coarse presentation-only recency for an already-thresholded place trend.
 * Never expose the source timestamp or derive an exact presence signal.
 */
export function formatPlaceActivityRecency(
  trending: boolean,
  recentActivityAt: string | null,
  nowMs = Date.now(),
): string | null {
  if (!trending || recentActivityAt == null) return null;

  const activityMs = Date.parse(recentActivityAt);
  if (!Number.isFinite(activityMs)) return null;

  const ageMs = Math.max(0, nowMs - activityMs);
  if (ageMs < FIVE_MINUTES_MS) return 'Active moments ago';
  if (ageMs < THIRTY_MINUTES_MS) return 'Active within the last 30 min';
  if (ageMs < TWO_HOURS_MS) return 'Active recently';

  return null;
}
