import AsyncStorage from '@react-native-async-storage/async-storage';

import { isValidFusionWorld } from './worldFusion';
import type { WorldModeId } from './worldModes';

const STORAGE_PREFIX = 'g88:world-fusion:v1:';
const FORMAT_VERSION = 1;

type StoredFusion = Readonly<{
  version: 1;
  discoveryWorld: WorldModeId | null;
}>;

/**
 * Fusion is stored independently from the user's existing World Mode, so
 * upgrading from the selector never rewrites the primary appearance setting.
 * Store only the optional secondary World (the primary is resolved from Redux).
 */
function keyForAccount(userId: string): string {
  if (!userId.trim()) throw new Error('A signed-in user is required');
  return STORAGE_PREFIX + encodeURIComponent(userId);
}

function isStoredFusion(value: unknown): value is StoredFusion {
  if (value == null || typeof value !== 'object' || Array.isArray(value)) {
    return false;
  }
  const record = value as Record<string, unknown>;
  return record.version === FORMAT_VERSION &&
    (record.discoveryWorld === null || isValidFusionWorld(record.discoveryWorld));
}

export async function readFusionDiscoveryWorld(userId: string): Promise<WorldModeId | null> {
  const raw = await AsyncStorage.getItem(keyForAccount(userId));
  if (raw == null) return null;
  try {
    const decoded: unknown = JSON.parse(raw);
    return isStoredFusion(decoded) ? decoded.discoveryWorld : null;
  } catch {
    // Corrupt or future-version data must never leak into navigation filters.
    return null;
  }
}

export async function writeFusionDiscoveryWorld(
  userId: string,
  discoveryWorld: WorldModeId | null,
): Promise<void> {
  if (discoveryWorld !== null && !isValidFusionWorld(discoveryWorld)) {
    throw new Error('Unknown discovery World');
  }
  const payload: StoredFusion = { version: FORMAT_VERSION, discoveryWorld };
  await AsyncStorage.setItem(keyForAccount(userId), JSON.stringify(payload));
}
