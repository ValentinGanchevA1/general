import AsyncStorage from '@react-native-async-storage/async-storage';

const STORAGE_PREFIX = '@g88/interactions-seen/v1/';

let activeUserId: string | null = null;
let seenAtMs = 0;
let hydrated = false;
const listeners = new Set<() => void>();

function notify(): void {
  for (const fn of listeners) {
    try {
      fn();
    } catch {
      // A subscriber must not prevent the remaining badge consumers updating.
    }
  }
}

function storageKey(userId: string): string {
  return `${STORAGE_PREFIX}${userId}`;
}

export function getInboxSeenAt(): number {
  return seenAtMs;
}

export function isInboxSeenHydrated(): boolean {
  return hydrated;
}

export async function hydrateInboxSeen(userId: string): Promise<void> {
  activeUserId = userId;
  hydrated = false;
  seenAtMs = 0;
  notify();

  try {
    const stored = await AsyncStorage.getItem(storageKey(userId));
    if (activeUserId !== userId) return;
    const parsed = stored == null ? 0 : Number(stored);
    const persistedAtMs = Number.isFinite(parsed) && parsed >= 0 ? parsed : 0;
    // Preserve an explicit acknowledgement that may occur while storage is hydrating.
    seenAtMs = Math.max(seenAtMs, persistedAtMs);
  } catch {
    // Storage failure must not leave the badge permanently unready or reject a fire-and-forget hydrate.
  } finally {
    if (activeUserId !== userId) return;
    hydrated = true;
    notify();
  }
}

export function markInboxSeen(atMs: number): void {
  if (!Number.isFinite(atMs) || atMs <= seenAtMs) return;
  seenAtMs = atMs;
  notify();

  const userId = activeUserId;
  if (userId) {
    void AsyncStorage.setItem(storageKey(userId), String(atMs)).catch(() => {
      // Keep the in-memory acknowledgement; a later explicit action can persist again.
    });
  }
}

/** Clear in-memory state on session end without deleting another account's watermark. */
export function resetInboxSeen(): void {
  activeUserId = null;
  seenAtMs = 0;
  hydrated = false;
  notify();
}

export function subscribeInboxSeen(fn: () => void): () => void {
  listeners.add(fn);
  return () => {
    listeners.delete(fn);
  };
}
