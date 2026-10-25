import type { DiscoveryDiff, DiscoveryPoint } from './api';

export type DiscoveryPointKey =
  | `cluster:${string}`
  | `user:${string}`
  | `event:${string}`
  | `listing:${string}`;

/**
 * Stable cross-domain identity for discovery points.
 * Raw entity ids are not globally unique across user/event/listing domains.
 */
export function getDiscoveryPointKey(point: DiscoveryPoint): DiscoveryPointKey {
  if (point.kind === 'cluster') return `cluster:${point.cellId}`;
  return `${point.kind}:${point.id}`;
}

/**
 * Applies a discovery diff without mutating the previous snapshot.
 *
 * The legacy server currently emits raw ids/cell ids in `removed`; canonical
 * keys are also accepted so the client can migrate independently and remain
 * backward compatible during the Map v2 rollout.
 */
export function applyDiscoveryDiff(
  current: readonly DiscoveryPoint[],
  diff: DiscoveryDiff,
): DiscoveryPoint[] {
  if (diff.added.length === 0 && diff.removed.length === 0) return [...current];

  const removed = new Set(diff.removed);
  const addedByKey = new Map<DiscoveryPointKey, DiscoveryPoint>();
  for (const point of diff.added) {
    addedByKey.set(getDiscoveryPointKey(point), point);
  }

  const next: DiscoveryPoint[] = [];
  for (const point of current) {
    const canonicalKey = getDiscoveryPointKey(point);
    const legacyKey = point.kind === 'cluster' ? point.cellId : point.id;
    if (removed.has(canonicalKey) || removed.has(legacyKey) || addedByKey.has(canonicalKey)) {
      continue;
    }
    next.push(point);
  }

  return [...addedByKey.values(), ...next];
}
