// apps/mobile/src/features/map/pendingCreateNearby.ts
// Module handoff: Create tab → MapScreen opens CreateNearbySheet.

let pending = false;
const listeners = new Set<() => void>();

export function requestOpenCreateNearby(): void {
  pending = true;
  for (const l of listeners) {
    try {
      l();
    } catch {
      /* ignore */
    }
  }
}

/** Returns true once and clears. */
export function takePendingOpenCreateNearby(): boolean {
  if (!pending) return false;
  pending = false;
  return true;
}

export function subscribePendingOpenCreateNearby(cb: () => void): () => void {
  listeners.add(cb);
  return () => {
    listeners.delete(cb);
  };
}
