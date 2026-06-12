// packages/shared/src/notifications.ts
//
// P3.3 push-notification preferences shared between backend and mobile.
// Channels are opt-in by default; a stored preference records an opt-out.

export const NOTIFICATION_CHANNELS = [
  'waves',
  'messages',
  'gifts',
  'nearby',
  'events',
  'listings',
  'digest',
] as const;

export type NotificationChannel = (typeof NOTIFICATION_CHANNELS)[number];

/** Per-channel UI metadata (label + helper). Mobile renders the settings rows from this. */
export const NOTIFICATION_CHANNEL_META: Record<
  NotificationChannel,
  { label: string; description: string }
> = {
  waves: { label: 'Waves', description: 'When someone waves at you' },
  messages: { label: 'Messages', description: 'New chat messages' },
  gifts: { label: 'Gifts', description: 'When someone sends you a gift' },
  nearby: { label: 'Nearby alerts', description: 'Alerts in your watched areas' },
  events: { label: 'Nearby events', description: 'New events in your watched areas' },
  listings: { label: 'Nearby listings', description: 'New items for sale near you' },
  digest: { label: 'Daily digest', description: 'A once-a-day summary of activity' },
};

/** All channels with their on/off state for a user (defaults applied). */
export type NotificationPreferences = Record<NotificationChannel, boolean>;

export interface UpdateNotificationPreferencesRequest {
  /** Partial map of channel → enabled. Omitted channels are unchanged. */
  preferences: Partial<NotificationPreferences>;
}
