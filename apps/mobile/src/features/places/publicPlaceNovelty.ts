import AsyncStorage from '@react-native-async-storage/async-storage';
import type { MapDiscoveryPoint, PlaceMapEntityPoint } from '@g88/shared';

const SEEN_PUBLIC_PLACE_KEY = 'g88:map_seen_public_place_keys';
const MAX_SEEN_PUBLIC_PLACES = 400;

export function publicPlaceNoveltyPoints(
  source: readonly MapDiscoveryPoint[],
): readonly PlaceMapEntityPoint[] {
  return source.filter((point): point is PlaceMapEntityPoint => (
    point.kind === 'place' &&
    point.meta.trending === true &&
    point.meta.locationPrecision === 'coarse'
  ));
}

export function publicPlaceNoveltyKey(point: PlaceMapEntityPoint): string {
  return `place:${point.id}`;
}

export function countUnseenPublicPlaces(
  source: readonly MapDiscoveryPoint[],
  seen: ReadonlySet<string>,
): { count: number; keys: string[] } {
  const keys = publicPlaceNoveltyPoints(source)
    .map(publicPlaceNoveltyKey)
    .filter((key) => !seen.has(key));
  return { count: keys.length, keys };
}

export function mergeSeenPublicPlaceKeys(
  seen: ReadonlySet<string>,
  keys: readonly string[],
): Set<string> {
  const next = new Set(seen);
  keys.forEach((key) => next.add(key));
  return next;
}

export async function loadSeenPublicPlaceKeys(): Promise<Set<string>> {
  try {
    const raw = await AsyncStorage.getItem(SEEN_PUBLIC_PLACE_KEY);
    if (!raw) return new Set();
    const parsed = JSON.parse(raw) as unknown;
    if (!Array.isArray(parsed)) return new Set();
    return new Set(parsed.filter((value): value is string => typeof value === 'string'));
  } catch {
    return new Set();
  }
}

export async function saveSeenPublicPlaceKeys(keys: ReadonlySet<string>): Promise<void> {
  const list = [...keys];
  const trimmed = list.length > MAX_SEEN_PUBLIC_PLACES
    ? list.slice(list.length - MAX_SEEN_PUBLIC_PLACES)
    : list;
  try {
    await AsyncStorage.setItem(SEEN_PUBLIC_PLACE_KEY, JSON.stringify(trimmed));
  } catch {
    // Novelty persistence is best-effort and must never block map discovery.
  }
}
