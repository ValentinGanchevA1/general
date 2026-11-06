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

/** Privacy-safe lock-screen copy. Detail is revealed only after authenticated re-entry. */
const lockScreenCopyByKind = {
  'interaction.wave': ['A wave reached you', 'Open NEXUS to see the interaction.'],
  'interaction.gift': ['You received a gift', 'Open NEXUS to see what arrived.'],
  'interaction.message': ['New message', 'Open NEXUS to read it.'],
  'interaction.connection-request': ['New connection request', 'Review it in NEXUS.'],
  'interaction.connection-accepted': ['Connection updated', 'A connection request was accepted.'],
  'live.nearby-alert': ['A live signal is nearby', "Open NEXUS to see what's happening."],
  'event.nearby': ['An event surfaced nearby', 'Open NEXUS to view it.'],
  'marketplace.nearby-listing': ['A marketplace listing surfaced nearby', 'Open NEXUS to view it.'],
  'trust.id-verified': ['Trust status updated', 'Open NEXUS Trust Center to review your status.'],
  'trust.id-rejected': ['Trust status needs attention', 'Open NEXUS Trust Center to review the next step.'],
  'discovery.daily-recap': ['Your NEXUS recap is ready', "Open NEXUS to catch up on today's activity."],
} as const satisfies Record<NexaNotificationKind, readonly [string, string]>;

export function nexaLockScreenCopy(
  kind: NexaNotificationKind,
): { title: string; body: string } {
  const [title, body] = lockScreenCopyByKind[kind];
  return { title, body };
}
