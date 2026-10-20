import {
  NEXA_NOTIFICATION_KIND_META,
  NEXA_NOTIFICATION_SCHEMA_VERSION,
  type NexaNotificationData,
  type NexaNotificationKind,
} from '@g88/shared';

export type NexaPushDataExtras = Partial<
  Pick<
    NexaNotificationData,
    | 'actorUserId'
    | 'entityId'
    | 'conversationId'
    | 'decision'
    | 'fromUserId'
    | 'peerUserId'
    | 'eventId'
    | 'listingId'
  >
>;

/**
 * Build the only data envelope the backend is allowed to send for NEXA v2.
 * Exact coordinates, addresses, message text and verification reasons are not
 * representable by this API.
 */
export function buildNexaPushData(
  kind: NexaNotificationKind,
  extras: NexaPushDataExtras = {},
): Record<string, string> {
  const meta = NEXA_NOTIFICATION_KIND_META[kind];
  const data: Record<string, string> = {
    schemaVersion: NEXA_NOTIFICATION_SCHEMA_VERSION,
    kind,
    pillar: meta.pillar,
    privacy: meta.privacy,
    target: meta.target,
    type: meta.legacyType,
  };

  for (const [key, value] of Object.entries(extras)) {
    if (typeof value === 'string' && value.length > 0) data[key] = value;
  }
  return data;
}

/** Privacy-safe lock-screen copy. Detail is revealed only after authenticated re-entry. */
export function nexaLockScreenCopy(
  kind: NexaNotificationKind,
): { title: string; body: string } {
  switch (kind) {
    case 'interaction.wave':
      return {
        title: 'A wave reached you',
        body: 'Open NEXA to see the interaction.',
      };
    case 'interaction.gift':
      return {
        title: 'You received a gift',
        body: 'Open NEXA to see what arrived.',
      };
    case 'interaction.message':
      return {
        title: 'New message',
        body: 'Open NEXA to read it.',
      };
    case 'interaction.connection-request':
      return {
        title: 'New connection request',
        body: 'Review it in NEXA.',
      };
    case 'interaction.connection-accepted':
      return {
        title: 'Connection updated',
        body: 'A connection request was accepted.',
      };
    case 'live.nearby-alert':
      return {
        title: 'A live signal is nearby',
        body: "Open NEXA to see what's happening.",
      };
    case 'event.nearby':
      return {
        title: 'An event surfaced nearby',
        body: 'Open NEXA to view it.',
      };
    case 'marketplace.nearby-listing':
      return {
        title: 'A marketplace listing surfaced nearby',
        body: 'Open NEXA to view it.',
      };
    case 'trust.id-verified':
      return {
        title: 'Trust status updated',
        body: 'Open NEXA Trust Center to review your status.',
      };
    case 'trust.id-rejected':
      return {
        title: 'Trust status needs attention',
        body: 'Open NEXA Trust Center to review the next step.',
      };
    case 'discovery.daily-recap':
      return {
        title: 'Your NEXA recap is ready',
        body: "Open NEXA to catch up on today's activity.",
      };
  }
}
