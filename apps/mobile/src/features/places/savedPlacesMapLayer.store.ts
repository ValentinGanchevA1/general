type Listener = () => void;

let enabled = false;
const listeners = new Set<Listener>();

function emit(): void {
  listeners.forEach((listener) => listener());
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
