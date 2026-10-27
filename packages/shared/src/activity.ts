// packages/shared/src/activity.ts
//
// Activity-feed types shared between backend (aggregator) and mobile (Pulse + FAB).
// Surface-agnostic: same shape powers REST /feed, the Pulse list, future socket push.

export type ActivityType = 'chat' | 'wave' | 'listing' | 'alert' | 'match' | 'event';

export type AreaCategory =
  | 'general'
  | 'food'
  | 'events'
  | 'help'
  | 'business'
  | 'news';

/**
 * Semantic local-action vocabulary for Pulse's narrative timeline.
 * `place_visit` is intentionally contract-ready but must only be produced by an
 * explicit user check-in flow; passive GPS presence must never create it.
 */
export type ActivityNarrativeKind =
  | 'alert_posted'
  | 'listing_created'
  | 'event_created'
  | 'event_joined'
  | 'place_visit'
  | 'place_trending';

export type ActivityNarrativeVerb =
  | 'posted'
  | 'listed'
  | 'created'
  | 'joined'
  | 'visited'
  | 'is active at';

export interface ActivityNarrative {
  kind: ActivityNarrativeKind;
  verb: ActivityNarrativeVerb;
  /** Human-readable entity/place/event/listing label. Never a coordinate. */
  objectLabel: string;
  /** Optional public place/context label. Never expose precise live location here. */
  placeLabel: string | null;
}

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

  /** Optional actor → action → object metadata for the mixed Pulse timeline. */
  narrative?: ActivityNarrative;

  /** What tapping the row does. Matches RootStackParamList screens. */
  deepLink: { screen: string; params?: Record<string, unknown> };
}

export interface FeedResponse {
  items: ActivityItem[];
  /** ISO timestamp to pass back as `since` for the next page (newest seen). */
  nextSince: string;
}

export const ACTIVITY_TYPES: readonly ActivityType[] = [
  'chat', 'wave', 'listing', 'alert', 'match', 'event',
] as const;

export const AREA_CATEGORIES: readonly AreaCategory[] = [
  'general', 'food', 'events', 'help', 'business', 'news',
] as const;
