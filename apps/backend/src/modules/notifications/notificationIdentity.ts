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
 * Build the only data envelope the backend is allowed to send for NEXUS v2.
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

/**
 * Canonical privacy-safe lock-screen copy for every supported notification kind.
 * An exhaustive lookup avoids repeating nearly identical switch branches and
 * ensures new kinds receive deliberate, reviewed user-facing text.
 */
const LOCK_SCREEN_COPY: Record<NexaNotificationKind, Readonly<{ title: string; body: string }>> = {
  'interaction.wave': {
    title: 'A wave reached you',
    body: 'Open NEXUS to see the interaction.',
  },
  'interaction.gift': {
    title: 'You received a gift',
    body: 'Open NEXUS to see what arrived.',
  },
  'interaction.message': {
    title: 'New message',
    body: 'Open NEXUS to read it.',
  },
  'interaction.connection-request': {
    title: 'New connection request',
    body: 'Review it in NEXUS.',
  },
  'interaction.connection-accepted': {
    title: 'Connection updated',
    body: 'A connection request was accepted.',
  },
  'live.nearby-alert': {
    title: 'A live signal is nearby',
    body: "Open NEXUS to see what's happening.",
  },
  'event.nearby': {
    title: 'An event surfaced nearby',
    body: 'Open NEXUS to view it.',
  },
  'marketplace.nearby-listing': {
    title: 'A marketplace listing surfaced nearby',
    body: 'Open NEXUS to view it.',
  },
  'trust.id-verified': {
    title: 'Trust status updated',
    body: 'Open NEXUS Trust Center to review your status.',
  },
  'trust.id-rejected': {
    title: 'Trust status needs attention',
    body: 'Open NEXUS Trust Center to review the next step.',
  },
  'discovery.daily-recap': {
    title: 'Your NEXUS recap is ready',
    body: "Open NEXUS to catch up on today's activity.",
  },
};

export function nexaLockScreenCopy(kind: NexaNotificationKind): { title: string; body: string } {
  return LOCK_SCREEN_COPY[kind];
}
