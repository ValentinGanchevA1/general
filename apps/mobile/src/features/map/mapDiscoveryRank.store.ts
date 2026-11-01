import type { DiscoveryRankBy } from '@g88/shared';

type Listener = () => void;

let rankBy: DiscoveryRankBy = 'relevance';
const listeners = new Set<Listener>();

function emit(): void {
  listeners.forEach((listener) => listener());
}

/**
 * Map-session UI state shared by the legacy and Place discovery lanes.
 * Contains only the selected sort enum; no viewer or location data.
 */
export const mapDiscoveryRankStore = {
  getSnapshot(): DiscoveryRankBy {
    return rankBy;
  },

  subscribe(listener: Listener): () => void {
    listeners.add(listener);
    return () => listeners.delete(listener);
  },

  set(next: DiscoveryRankBy): void {
    if (rankBy === next) return;
    rankBy = next;
    emit();
  },

  reset(): void {
    if (rankBy === 'relevance') return;
    rankBy = 'relevance';
    emit();
  },
};
