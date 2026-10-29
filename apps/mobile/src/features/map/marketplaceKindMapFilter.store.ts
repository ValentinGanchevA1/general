import type { MarketplaceKind } from '@g88/shared';

export type MarketplaceKindMapFilterValue = 'all' | MarketplaceKind;

type Listener = () => void;

let value: MarketplaceKindMapFilterValue = 'all';
const listeners = new Set<Listener>();

function emit(): void {
  listeners.forEach((listener) => listener());
}

/** Map-scoped UI filter. It contains no private/user data and may persist across tab navigation. */
export const marketplaceKindMapFilterStore = {
  getSnapshot(): MarketplaceKindMapFilterValue {
    return value;
  },

  subscribe(listener: Listener): () => void {
    listeners.add(listener);
    return () => listeners.delete(listener);
  },

  set(next: MarketplaceKindMapFilterValue): void {
    if (value === next) return;
    value = next;
    emit();
  },

  reset(): void {
    if (value === 'all') return;
    value = 'all';
    emit();
  },
};
