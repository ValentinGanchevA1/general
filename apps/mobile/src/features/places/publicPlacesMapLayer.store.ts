type Listener = () => void;

let enabled = true;
const listeners = new Set<Listener>();

function emit(): void {
  listeners.forEach((listener) => listener());
}

/**
 * Map-only presentation preference for the public, k-anonymous Places layer.
 * Private saved/focused place points are intentionally controlled elsewhere.
 */
export const publicPlacesMapLayerStore = {
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
    if (enabled) return;
    enabled = true;
    emit();
  },
};
