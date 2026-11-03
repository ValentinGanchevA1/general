/** Session-only map lens state shared by bottom-tab actions and the single Map surface. */
export type NexaSpatialLens = 'map' | 'experiences' | 'opportunities' | 'custom';

let currentLens: NexaSpatialLens = 'map';
const subscribers = new Set<() => void>();

export const nexaSpatialLensStore = {
  subscribe(listener: () => void): () => void {
    subscribers.add(listener);
    return () => { subscribers.delete(listener); };
  },
  getSnapshot(): NexaSpatialLens {
    return currentLens;
  },
  set(next: NexaSpatialLens): void {
    if (next === currentLens) return;
    currentLens = next;
    subscribers.forEach((listener) => listener());
  },
};
