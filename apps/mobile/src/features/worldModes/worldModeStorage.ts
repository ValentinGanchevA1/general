import AsyncStorage from '@react-native-async-storage/async-storage';

import { isWorldModeId, type WorldModeId } from './worldModes';

const STORAGE_PREFIX = 'g88:world-mode:v1:';
const FIRST_RUN_PREFIX = 'g88:world-mode-first-run:v1:';

/** Device-only World preference, scoped to the authenticated account. */
function keyForUser(prefix: string, userId: string): string {
  if (!userId.trim()) throw new Error('A signed-in user is required');
  return prefix + encodeURIComponent(userId);
}

export async function readWorldMode(userId: string): Promise<WorldModeId> {
  const stored = await AsyncStorage.getItem(keyForUser(STORAGE_PREFIX, userId));
  return isWorldModeId(stored) ? stored : 'nexus';
}

export async function writeWorldMode(userId: string, mode: WorldModeId): Promise<void> {
  if (!isWorldModeId(mode)) throw new Error('Unknown World Mode');
  await AsyncStorage.setItem(keyForUser(STORAGE_PREFIX, userId), mode);
}

/** Set only after a successful email registration, before the auth thunk resolves. */
export async function markWorldSelectionPending(userId: string): Promise<void> {
  await AsyncStorage.setItem(keyForUser(FIRST_RUN_PREFIX, userId), '1');
}

export async function readWorldSelectionPending(userId: string): Promise<boolean> {
  return (await AsyncStorage.getItem(keyForUser(FIRST_RUN_PREFIX, userId))) === '1';
}

/** Persist the explicit choice first; clear the first-run marker only after that succeeds. */
export async function persistFirstRunWorldSelection(
  userId: string,
  mode: WorldModeId,
): Promise<void> {
  await writeWorldMode(userId, mode);
  // Marker cleanup is best-effort: the preference is already persisted. If cleanup
  // fails, the next launch safely offers the selector again instead of reverting
  // the in-memory choice to NEXUS or trapping the user on a storage error.
  try {
    await AsyncStorage.removeItem(keyForUser(FIRST_RUN_PREFIX, userId));
  } catch {
    // Keep the marker for a later retry.
  }
}
