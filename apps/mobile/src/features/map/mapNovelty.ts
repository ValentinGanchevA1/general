// apps/mobile/src/features/map/mapNovelty.ts
// Client-side "new near you" — seen entity keys + count of unseen pins.

import AsyncStorage from '@react-native-async-storage/async-storage';
import type { DiscoveryPoint, EntityPoint } from '@g88/shared';

const SEEN_KEY = 'g88:map_seen_entity_keys';
const MAX_SEEN = 400;

export function entityPointKey(p: EntityPoint): string {
  return `${p.kind}:${p.id}`;
}

export function isEntityPoint(p: DiscoveryPoint): p is EntityPoint {
  return p.kind === 'user' || p.kind === 'event' || p.kind === 'listing';
}

export async function loadSeenKeys(): Promise<Set<string>> {
  try {
    const raw = await AsyncStorage.getItem(SEEN_KEY);
    if (!raw) return new Set();
    const arr = JSON.parse(raw) as unknown;
    if (!Array.isArray(arr)) return new Set();
    return new Set(arr.filter((x): x is string => typeof x === 'string'));
  } catch {
    return new Set();
  }
}

export async function saveSeenKeys(keys: Set<string>): Promise<void> {
  const list = [...keys];
  const trimmed = list.length > MAX_SEEN ? list.slice(list.length - MAX_SEEN) : list;
  try {
    await AsyncStorage.setItem(SEEN_KEY, JSON.stringify(trimmed));
  } catch {
    // ignore
  }
}

/** Unseen entity pins in the current discovery set. */
export function countUnseen(
  points: DiscoveryPoint[],
  seen: Set<string>,
): { count: number; keys: string[] } {
  const keys: string[] = [];
  for (const p of points) {
    if (!isEntityPoint(p)) continue;
    const k = entityPointKey(p);
    if (!seen.has(k)) keys.push(k);
  }
  return { count: keys.length, keys };
}

export function mergeSeen(seen: Set<string>, keys: string[]): Set<string> {
  const next = new Set(seen);
  for (const k of keys) next.add(k);
  return next;
}
