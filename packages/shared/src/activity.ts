// packages/shared/src/activity.ts
//
// Activity-feed types shared between backend (aggregator) and mobile (Pulse + FAB).
// Surface-agnostic: same shape powers REST /feed, the Pulse list, future socket push.

export type ActivityType = 'chat' | 'wave' | 'listing' | 'alert' | 'match';

export type AreaCategory =
  | 'general'
  | 'food'
  | 'events'
  | 'help'
  | 'business'
  | 'news';

export interface ActivityItem {
  /** Composite key, stable for list dedupe: `${type}:${refId}`. */
  id: string;
  type: ActivityType;
  /** Only set on `alert` items (v1.5 — Nextdoor-style posts). */
  category: AreaCategory | null;

  title: string;
  preview: string;

  actorId: string | null;
  actorName: string | null;

  /** Server-computed from fuzzed locations. Null when source has no geo. */
  distanceM: number | null;

  /** ISO 8601, UTC. */
  createdAt: string;

  /** Drives bold + dot in the UI. Source-specific heuristic. */
  unread: boolean;

  /** What tapping the row does. Matches RootStackParamList screens. */
  deepLink: { screen: string; params?: Record<string, unknown> };
}

export interface FeedResponse {
  items: ActivityItem[];
  /** ISO timestamp to pass back as `since` for the next page (newest seen). */
  nextSince: string;
}

export const ACTIVITY_TYPES: readonly ActivityType[] = [
  'chat', 'wave', 'listing', 'alert', 'match',
] as const;

export const AREA_CATEGORIES: readonly AreaCategory[] = [
  'general', 'food', 'events', 'help', 'business', 'news',
] as const;
