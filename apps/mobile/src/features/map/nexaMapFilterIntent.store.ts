/**
 * Session-only, non-sensitive summary of manually chosen map filters.
 *
 * World Fusion is NOT authorized to override a custom layer selection,
 * search, people-only/privacy filter, listing mode or map overlay.
 * It cannot read the MapScreen's local state directly from Account screens,
 * so MapScreen explicitly publishes only whether manual intent exists.
 */
export type NexaMapFilterIntent = Readonly<{
  known: boolean;
  hasExplicitFilters: boolean;
}>;

const UNKNOWN: NexaMapFilterIntent = Object.freeze({
  known: false,
  hasExplicitFilters: true, // fail closed
});
const DEFAULT: NexaMapFilterIntent = Object.freeze({
  known: true,
  hasExplicitFilters: false,
});
const CUSTOM: NexaMapFilterIntent = Object.freeze({
  known: true,
  hasExplicitFilters: true,
});

let snapshot: NexaMapFilterIntent = UNKNOWN;
const subscribers = new Set<() => void>();

export const nexaMapFilterIntentStore = {
  getSnapshot(): NexaMapFilterIntent {
    return snapshot;
  },

  subscribe(listener: () => void): () => void {
    subscribers.add(listener);
    return () => { subscribers.delete(listener); };
  },

  /** Called by the mounted MapScreen after React commits local filter state. */
  publish(hasExplicitFilters: boolean): void {
    const next = hasExplicitFilters ? CUSTOM : DEFAULT;
    if (snapshot === next) return;
    snapshot = next;
    subscribers.forEach((listener) => listener());
  },

  /** Unknown means World Fusion must not modify the current lens. */
  reset(): void {
    if (snapshot === UNKNOWN) return;
    snapshot = UNKNOWN;
    subscribers.forEach((listener) => listener());
  },
};
