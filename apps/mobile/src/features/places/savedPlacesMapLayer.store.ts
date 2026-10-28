type Listener = () => void;

let enabled = false;
const listeners = new Set<Listener>();

function emit(): void {
  listeners.forEach((listener) => listener());
}

/**
 * Private map-layer UI state must never carry across authenticated identities.
 * A transition from no user -> user is a fresh login and starts from the default
 * disabled state, while logout and direct account switches clear any prior choice.
 */
export function shouldResetSavedPlacesMapLayer(
  previousUserId: string | null,
  nextUserId: string | null,
): boolean {
  return previousUserId !== null && previousUserId !== nextUserId;
}

export const savedPlacesMapLayerStore = {
  getSnapshot(): boolean {
    return enabled;
  },

  subscribe(listener: Listener): () => void {
    listeners.add(listener);
    return () => listeners.delete(listener);
  },

  setEnabled(next: boolean): void {
    if (enabled === next) return;
    enabled = next;
    emit();
  },

  reset(): void {
    if (!enabled) return;
    enabled = false;
    emit();
  },
};
