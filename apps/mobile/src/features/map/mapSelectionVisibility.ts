type Listener = () => void;

let selectedEntityVisible = false;
const listeners = new Set<Listener>();

function emit(): void {
  for (const listener of listeners) listener();
}

/**
 * Tiny external store used only to coordinate sibling map overlays.
 * MapMarkers owns selected-entity truth; rails consume this snapshot so a
 * contextual entity surface never competes with nearby discovery surfaces.
 */
export const mapSelectionVisibility = {
  setSelected(visible: boolean): void {
    if (selectedEntityVisible === visible) return;
    selectedEntityVisible = visible;
    emit();
  },

  getSnapshot(): boolean {
    return selectedEntityVisible;
  },

  subscribe(listener: Listener): () => void {
    listeners.add(listener);
    return () => listeners.delete(listener);
  },
};
