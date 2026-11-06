import AsyncStorage from '@react-native-async-storage/async-storage';

import { isWorldModeId, type WorldModeId } from './worldModes';

const STORAGE_PREFIX = 'g88:world-mode:v1:';

/** Device-only preference, separated per signed-in account. No profile data stored. */
function keyForUser(userId: string): string {
  if (!userId.trim()) throw new Error('A signed-in user is required');
  return STORAGE_PREFIX + encodeURIComponent(userId);
}

export async function readWorldMode(userId: string): Promise<WorldModeId> {
  const stored = await AsyncStorage.getItem(keyForUser(userId));
  return isWorldModeId(stored) ? stored : 'nexus';
}

export async function writeWorldMode(userId: string, mode: WorldModeId): Promise<void> {
  if (!isWorldModeId(mode)) throw new Error('Unknown World Mode');
  await AsyncStorage.setItem(keyForUser(userId), mode);
}