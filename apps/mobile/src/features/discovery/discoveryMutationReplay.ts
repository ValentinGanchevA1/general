import {
  getDiscoveryPointKey,
  type DiscoveryPoint,
  type DiscoveryPointKey,
  type EntityPoint,
} from '@g88/shared';

export type DiscoveryRealtimeMutation =
  | { sequence: number; type: 'upsert'; point: EntityPoint }
  | { sequence: number; type: 'remove'; key: DiscoveryPointKey };

/**
 * Replays realtime mutations that arrived after an HTTP discovery request
 * started. This prevents a slower HTTP snapshot from overwriting newer socket
 * state when the response is committed to Redux.
 */
export function replayDiscoveryMutations(
  httpPoints: readonly DiscoveryPoint[],
  mutations: readonly DiscoveryRealtimeMutation[],
  afterSequence: number,
): DiscoveryPoint[] {
  const byKey = new Map<DiscoveryPointKey, DiscoveryPoint>();
  const order: DiscoveryPointKey[] = [];

  for (const point of httpPoints) {
    const key = getDiscoveryPointKey(point);
    if (!byKey.has(key)) order.push(key);
    byKey.set(key, point);
  }

  for (const mutation of mutations) {
    if (mutation.sequence <= afterSequence) continue;

    if (mutation.type === 'remove') {
      byKey.delete(mutation.key);
      continue;
    }

    const key = getDiscoveryPointKey(mutation.point);
    if (!byKey.has(key)) order.push(key);
    byKey.set(key, mutation.point);
  }

  return order.flatMap((key) => {
    const point = byKey.get(key);
    return point === undefined ? [] : [point];
  });
}
