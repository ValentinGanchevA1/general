// Privacy-safe product analytics contract shared by mobile and backend.
//
// Deliberately low-cardinality: IDs, coordinates, free text, prices, contact
// details and verification payloads do not belong in this stream.

export const PRODUCT_ANALYTICS_EVENTS = [
  'app.session_started',
  'entity.opened',
  'interaction.wave_sent',
  'event.rsvp_confirmed',
  'marketplace.offer_sent',
  'connection.created',
  'chat.message_sent',
] as const;

export type ProductAnalyticsEventName = (typeof PRODUCT_ANALYTICS_EVENTS)[number];

export type ProductAnalyticsPropertyValue = string | number | boolean | null;
export type ProductAnalyticsProperties = Record<string, ProductAnalyticsPropertyValue>;

export interface ProductAnalyticsIngestRequest {
  event: ProductAnalyticsEventName;
  /** Server applies a second allow-list and drops unknown keys/values. */
  properties?: ProductAnalyticsProperties;
}

export const PRODUCT_ANALYTICS_ENTITY_TYPES = ['person', 'event', 'listing'] as const;
export type ProductAnalyticsEntityType = (typeof PRODUCT_ANALYTICS_ENTITY_TYPES)[number];

export const PRODUCT_ANALYTICS_SURFACES = ['map', 'discover', 'pulse', 'profile', 'detail'] as const;
export type ProductAnalyticsSurface = (typeof PRODUCT_ANALYTICS_SURFACES)[number];

export const PRODUCT_ANALYTICS_CONNECTION_MECHANISMS = ['wave', 'friend', 'dating'] as const;
export type ProductAnalyticsConnectionMechanism =
  (typeof PRODUCT_ANALYTICS_CONNECTION_MECHANISMS)[number];
