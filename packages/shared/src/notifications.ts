// packages/shared/src/notifications.ts
//
// Notification preferences and the NEXA v2 push identity contract shared by
// backend and mobile. FCM data values are strings by contract.

export const NOTIFICATION_CHANNELS = [
  'waves',
  'messages',
  'gifts',
  'friends',
  'nearby',
  'events',
  'listings',
  'digest',
] as const;

export type NotificationChannel = (typeof NOTIFICATION_CHANNELS)[number];

/** Per-channel UI metadata. Mobile renders the settings rows from this. */
export const NOTIFICATION_CHANNEL_META: Record<
  NotificationChannel,
  { label: string; description: string }
> = {
  waves: { label: 'Waves', description: 'Direct waves and lightweight interactions' },
  messages: { label: 'Messages', description: 'New private conversations' },
  gifts: { label: 'Gifts', description: 'When a new gift reaches you' },
  friends: { label: 'Connections', description: 'Connection requests and accepts' },
  nearby: { label: 'Live nearby', description: 'Live signals in areas you watch' },
  events: { label: 'Events nearby', description: 'Events surfacing in watched areas' },
  listings: { label: 'Marketplace nearby', description: 'Local marketplace discoveries' },
  digest: { label: 'NEXA recap', description: 'A private daily activity recap' },
};

/** All channels with their on/off state for a user (defaults applied). */
export type NotificationPreferences = Record<NotificationChannel, boolean>;

export interface UpdateNotificationPreferencesRequest {
  /** Partial map of channel → enabled. Omitted channels are unchanged. */
  preferences: Partial<NotificationPreferences>;
}

// ─── NEXA notification identity v2 ──────────────────────────────────────────

export const NEXA_NOTIFICATION_SCHEMA_VERSION = '2' as const;

/** Semantic product pillar, independent from delivery channel names. */
export type NexaNotificationPillar =
  | 'discovery'
  | 'live'
  | 'interaction'
  | 'event'
  | 'marketplace'
  | 'trust';

/**
 * `sensitive` copy must never expose private message text, verification reasons,
 * exact location, address or precise spatial identifiers on the lock screen.
 */
export type NexaNotificationPrivacy = 'ambient' | 'private' | 'sensitive';

/** Allow-listed re-entry destinations. Payloads never carry arbitrary routes. */
export type NexaNotificationTarget =
  | 'map'
  | 'chat'
  | 'interactions'
  | 'gifts'
  | 'pulse'
  | 'event-detail'
  | 'listing-detail'
  | 'trust-center';

export const NEXA_NOTIFICATION_KINDS = [
  'interaction.wave',
  'interaction.gift',
  'interaction.message',
  'interaction.connection-request',
  'interaction.connection-accepted',
  'live.nearby-alert',
  'event.nearby',
  'marketplace.nearby-listing',
  'trust.id-verified',
  'trust.id-rejected',
  'discovery.daily-recap',
] as const;

export type NexaNotificationKind = (typeof NEXA_NOTIFICATION_KINDS)[number];

export interface NexaNotificationKindMeta {
  pillar: NexaNotificationPillar;
  privacy: NexaNotificationPrivacy;
  target: NexaNotificationTarget;
  /** Old clients continue to understand this value during migration. */
  legacyType:
    | 'wave'
    | 'gift'
    | 'message'
    | 'friend_request'
    | 'friend_accepted'
    | 'alert'
    | 'event'
    | 'listing'
    | 'id_verification'
    | 'digest';
}

export const NEXA_NOTIFICATION_KIND_META: Record<
  NexaNotificationKind,
  NexaNotificationKindMeta
> = {
  'interaction.wave': {
    pillar: 'interaction',
    privacy: 'private',
    target: 'map',
    legacyType: 'wave',
  },
  'interaction.gift': {
    pillar: 'interaction',
    privacy: 'private',
    target: 'gifts',
    legacyType: 'gift',
  },
  'interaction.message': {
    pillar: 'interaction',
    privacy: 'sensitive',
    target: 'chat',
    legacyType: 'message',
  },
  'interaction.connection-request': {
    pillar: 'interaction',
    privacy: 'private',
    target: 'interactions',
    legacyType: 'friend_request',
  },
  'interaction.connection-accepted': {
    pillar: 'interaction',
    privacy: 'private',
    target: 'map',
    legacyType: 'friend_accepted',
  },
  'live.nearby-alert': {
    pillar: 'live',
    privacy: 'ambient',
    target: 'pulse',
    legacyType: 'alert',
  },
  'event.nearby': {
    pillar: 'event',
    privacy: 'ambient',
    target: 'event-detail',
    legacyType: 'event',
  },
  'marketplace.nearby-listing': {
    pillar: 'marketplace',
    privacy: 'ambient',
    target: 'listing-detail',
    legacyType: 'listing',
  },
  'trust.id-verified': {
    pillar: 'trust',
    privacy: 'sensitive',
    target: 'trust-center',
    legacyType: 'id_verification',
  },
  'trust.id-rejected': {
    pillar: 'trust',
    privacy: 'sensitive',
    target: 'trust-center',
    legacyType: 'id_verification',
  },
  'discovery.daily-recap': {
    pillar: 'discovery',
    privacy: 'private',
    target: 'interactions',
    legacyType: 'digest',
  },
};

/**
 * Canonical FCM data envelope. Entity/user IDs are opaque identifiers only —
 * coordinates, addresses, message previews and verification reasons are banned.
 */
export interface NexaNotificationData {
  schemaVersion: typeof NEXA_NOTIFICATION_SCHEMA_VERSION;
  kind: NexaNotificationKind;
  pillar: NexaNotificationPillar;
  privacy: NexaNotificationPrivacy;
  target: NexaNotificationTarget;
  type: NexaNotificationKindMeta['legacyType'];
  actorUserId?: string;
  entityId?: string;
  conversationId?: string;
  decision?: 'verified' | 'rejected';
  /** Legacy aliases retained only for pre-v2 mobile clients. */
  fromUserId?: string;
  peerUserId?: string;
  eventId?: string;
  listingId?: string;
}
