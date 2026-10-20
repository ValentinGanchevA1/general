import {
  NEXA_NOTIFICATION_KINDS,
  NEXA_NOTIFICATION_SCHEMA_VERSION,
  type NexaNotificationKind,
} from '@g88/shared';

export type NexaNotificationReentry =
  | { type: 'map'; focusUserId?: string }
  | { type: 'chat'; conversationId: string }
  | { type: 'interactions' }
  | { type: 'gifts' }
  | { type: 'pulse-nearby' }
  | { type: 'event-detail'; eventId: string }
  | { type: 'listing-detail'; listingId: string }
  | { type: 'trust-center' };

type PushData = Readonly<Record<string, string | undefined>>;

const KINDS = new Set<string>(NEXA_NOTIFICATION_KINDS);

function isKind(value: string | undefined): value is NexaNotificationKind {
  return value != null && KINDS.has(value);
}

function safeOpaqueId(value: string | undefined): string | null {
  if (!value) return null;
  const trimmed = value.trim();
  if (trimmed.length === 0 || trimmed.length > 160) return null;
  return /^[A-Za-z0-9:_-]+$/.test(trimmed) ? trimmed : null;
}

function legacyKind(data: PushData): NexaNotificationKind | null {
  switch (data.type) {
    case 'wave':
      return 'interaction.wave';
    case 'gift':
      return 'interaction.gift';
    case 'message':
      return 'interaction.message';
    case 'friend_request':
      return 'interaction.connection-request';
    case 'friend_accepted':
      return 'interaction.connection-accepted';
    case 'alert':
      return 'live.nearby-alert';
    case 'event':
      return 'event.nearby';
    case 'listing':
      return 'marketplace.nearby-listing';
    case 'id_verification':
      return data.decision === 'verified'
        ? 'trust.id-verified'
        : 'trust.id-rejected';
    case 'digest':
      return 'discovery.daily-recap';
    default:
      return null;
  }
}

function resolveKind(data: PushData): NexaNotificationKind | null {
  if (data.schemaVersion === NEXA_NOTIFICATION_SCHEMA_VERSION) {
    return isKind(data.kind) ? data.kind : null;
  }
  return legacyKind(data);
}

/**
 * Treat push data as untrusted input. The payload may identify an entity, but it
 * can never choose an arbitrary React Navigation route or carry coordinates.
 * Malformed or unsupported payloads fall back to the Map instead of crashing.
 */
export function resolveNexaNotificationReentry(
  data: PushData | undefined,
): NexaNotificationReentry {
  if (!data) return { type: 'map' };

  const kind = resolveKind(data);
  if (!kind) return { type: 'map' };

  switch (kind) {
    case 'interaction.wave': {
      const userId = safeOpaqueId(data.actorUserId ?? data.fromUserId);
      return userId ? { type: 'map', focusUserId: userId } : { type: 'map' };
    }
    case 'interaction.gift':
      return { type: 'gifts' };
    case 'interaction.message': {
      const conversationId = safeOpaqueId(data.conversationId);
      return conversationId
        ? { type: 'chat', conversationId }
        : { type: 'interactions' };
    }
    case 'interaction.connection-request':
      return { type: 'interactions' };
    case 'interaction.connection-accepted': {
      const userId = safeOpaqueId(data.actorUserId ?? data.peerUserId);
      return userId ? { type: 'map', focusUserId: userId } : { type: 'interactions' };
    }
    case 'live.nearby-alert':
      return { type: 'pulse-nearby' };
    case 'event.nearby': {
      const eventId = safeOpaqueId(data.entityId ?? data.eventId);
      return eventId ? { type: 'event-detail', eventId } : { type: 'map' };
    }
    case 'marketplace.nearby-listing': {
      const listingId = safeOpaqueId(data.entityId ?? data.listingId);
      return listingId ? { type: 'listing-detail', listingId } : { type: 'map' };
    }
    case 'trust.id-verified':
    case 'trust.id-rejected':
      return { type: 'trust-center' };
    case 'discovery.daily-recap':
      return { type: 'interactions' };
  }
}
