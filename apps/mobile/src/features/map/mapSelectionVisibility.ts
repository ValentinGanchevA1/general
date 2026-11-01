type Listener = () => void;

let selectedEntityVisible = false;
const listeners = new Set<Listener>();

function emit(): void {
  for (const listener of listeners) listener();
}

/** Renderer-agnostic selection keys all represent one contextual map surface. */
export function hasContextualMapSelection(selectionKey: string | null): boolean {
  return selectionKey !== null;
}

/**
 * Tiny external store used only to coordinate sibling map overlays.
 * NexaMapScreenSurface owns selected-entity truth so Google/React Native Maps,
 * MapLibre, and first-class Place previews publish the same visibility state.
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
