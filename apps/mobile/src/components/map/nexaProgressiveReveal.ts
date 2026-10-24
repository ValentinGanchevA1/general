import type { NexaMapZoomBand } from './nexaMapZoomDensity';

export const NEXA_INITIAL_MARKER_REVEAL_COUNT = 28;
export const NEXA_MARKER_REVEAL_BATCH_SIZE = 32;
export const NEXA_MARKER_REVEAL_INTERVAL_MS = 70;
export const NEXA_REVEAL_REPLACEMENT_RESET_RATIO = 0.6;

/**
 * A zoom-band transition represents a new spatial disclosure level. Resetting
 * the reveal budget there avoids dumping a previously accumulated marker count
 * into the new viewport, while same-band realtime updates remain stable.
 */
export function resolveNexaMarkerRevealCountForBand(
  previousBand: NexaMapZoomBand,
  nextBand: NexaMapZoomBand,
  currentCount: number,
): number {
  if (previousBand !== nextBand) return NEXA_INITIAL_MARKER_REVEAL_COUNT;
  return Math.max(0, currentCount);
}

/**
 * Mirrors the discovery backend's major-replacement fallback threshold. A large
 * same-band pan should restart progressive disclosure, while small diffs and
 * realtime churn should preserve the accumulated reveal budget.
 */
export function shouldResetNexaRevealForReplacement(
  previousKeys: readonly string[],
  nextKeys: readonly string[],
  threshold = NEXA_REVEAL_REPLACEMENT_RESET_RATIO,
): boolean {
  if (previousKeys.length === 0 || nextKeys.length === 0) return false;

  const nextSet = new Set(nextKeys);
  let removedCount = 0;
  for (const key of previousKeys) {
    if (!nextSet.has(key)) removedCount += 1;
  }

  return removedCount / previousKeys.length > threshold;
}

/**
 * Reveals the initial native marker set in short batches so a dense viewport
 * becomes legible instead of appearing as one abrupt bitmap burst.
 * Reduced Motion always reveals the full set immediately.
 */
export function nextNexaMarkerRevealCount(
  current: number,
  total: number,
  reduceMotion: boolean,
): number {
  if (total <= 0) return 0;
  if (reduceMotion) return total;
  if (current >= total) return total;

  const safeCurrent = Math.max(
    Math.min(current, total),
    Math.min(NEXA_INITIAL_MARKER_REVEAL_COUNT, total),
  );
  return Math.min(total, safeCurrent + NEXA_MARKER_REVEAL_BATCH_SIZE);
}
