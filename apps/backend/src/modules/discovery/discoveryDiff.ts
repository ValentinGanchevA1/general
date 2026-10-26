import {
  getDiscoveryPointKey,
  type DiscoveryDiff,
  type DiscoveryPoint,
} from '@g88/shared';

export const DISCOVERY_DIFF_FALLBACK_THRESHOLD = 0.6;

function canonicalJson(value: unknown): string {
  return JSON.stringify(value, (key, val: unknown) => {
    if (key === 'rankScore') return undefined;
    if (val && typeof val === 'object' && !Array.isArray(val)) {
      return Object.keys(val as Record<string, unknown>)
        .sort((a, b) => a.localeCompare(b))
        .reduce<Record<string, unknown>>((acc, currentKey) => {
          if (currentKey === 'rankScore') return acc;
          acc[currentKey] = (val as Record<string, unknown>)[currentKey];
          return acc;
        }, {});
    }
    return val;
  });
}

/**
 * Produces an incremental discovery diff using the same canonical identity that
 * the mobile cache and renderer use. This prevents cross-domain raw-id
 * collisions (for example user:<uuid> vs event:<uuid>) from removing or
 * replacing the wrong point.
 *
 * rankScore is intentionally excluded from equality because ranking changes
 * alone do not change the public map projection of a point.
 */
export function buildDiscoveryDiff(
  previousPoints: readonly DiscoveryPoint[],
  currentPoints: readonly DiscoveryPoint[],
  fallbackThreshold = DISCOVERY_DIFF_FALLBACK_THRESHOLD,
): DiscoveryDiff | null {
  const currentByKey = new Map(
    currentPoints.map((point) => [getDiscoveryPointKey(point), point] as const),
  );
  const previousByKey = new Map(
    previousPoints.map((point) => [getDiscoveryPointKey(point), point] as const),
  );

  const removed: string[] = [];
  const added: DiscoveryPoint[] = [];
  let pureRemovedCount = 0;

  for (const [key, previousPoint] of previousByKey) {
    const currentPoint = currentByKey.get(key);
    if (!currentPoint) {
      removed.push(key);
      pureRemovedCount += 1;
      continue;
    }

    if (canonicalJson(previousPoint) !== canonicalJson(currentPoint)) {
      removed.push(key);
      added.push(currentPoint);
    }
  }

  for (const [key, currentPoint] of currentByKey) {
    if (!previousByKey.has(key)) added.push(currentPoint);
  }

  if (
    previousPoints.length > 0 &&
    pureRemovedCount / previousPoints.length > fallbackThreshold
  ) {
    return null;
  }

  return { added, removed };
}

/**
 * Parses a Redis discovery snapshot and delegates identity/equality semantics to
 * buildDiscoveryDiff. Corrupt or non-array snapshots deliberately fall back to
 * a full response rather than attempting a partial diff from untrusted cache
 * state.
 */
export function buildDiscoveryDiffFromSnapshot(
  rawSnapshot: string,
  currentPoints: readonly DiscoveryPoint[],
  fallbackThreshold = DISCOVERY_DIFF_FALLBACK_THRESHOLD,
): DiscoveryDiff | null {
  let parsed: unknown;
  try {
    parsed = JSON.parse(rawSnapshot) as unknown;
  } catch {
    return null;
  }

  if (!Array.isArray(parsed)) return null;
  return buildDiscoveryDiff(
    parsed as DiscoveryPoint[],
    currentPoints,
    fallbackThreshold,
  );
}
