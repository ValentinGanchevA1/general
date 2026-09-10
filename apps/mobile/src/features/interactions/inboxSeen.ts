/**
 * Shared seen watermark for received interactions (waves / story reactions).
 * Module singleton so MapScreen 👋 badge and InteractionsScreen markSeen()
 * share the same value — useReceivedInteractions is mounted in both places.
 */

let seenAtMs = Date.now();
const listeners = new Set<() => void>();

export function getInboxSeenAt(): number {
  return seenAtMs;
}

export function markInboxSeen(atMs: number = Date.now()): void {
  if (atMs < seenAtMs) return;
  seenAtMs = atMs;
  for (const fn of listeners) {
    try {
      fn();
    } catch {
      /* ignore */
    }
  }
}

/** Reset on session end so the next account does not inherit the previous watermark. */
export function resetInboxSeen(): void {
  seenAtMs = Date.now();
  for (const fn of listeners) {
    try {
      fn();
    } catch {
      /* ignore */
    }
  }
}

export function subscribeInboxSeen(fn: () => void): () => void {
  listeners.add(fn);
  return () => {
    listeners.delete(fn);
  };
}
