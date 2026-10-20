export const NEXA_INITIAL_MARKER_REVEAL_COUNT = 28;
export const NEXA_MARKER_REVEAL_BATCH_SIZE = 32;
export const NEXA_MARKER_REVEAL_INTERVAL_MS = 70;

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
