import type { LatLng, EntityKind, VerificationLevel } from './api';

// ─── Server → Client ───────────────────────────────────────────────────────

export interface WaveReceivedEvent {
  waveId: string;
  fromUser: {
    id: string;
    displayName: string;
    avatarUrl: string | null;
    verification: VerificationLevel;
  };
  context: 'map' | 'profile' | 'event';
  createdAt: string;
}

export interface PresenceDelta {
  cellId: string;
  /** Users that became online in this cell since the last delta. */
  added: Array<{ userId: string; lat: number; lng: number }>;
  /** Users that went offline or moved out of this cell. */
  removed: string[];
}

export interface ChatMessageEvent {
  id: string;
  conversationId: string;
  senderId: string;
  body: string;
  createdAt: string;
}

export interface ConversationOpenedEvent {
  conversationId: string;
  participantIds: string[];
  /** If non-null, this conversation was opened by a wave that just reciprocated. */
  triggeringWaveId: string | null;
}

export interface ServerToClientEvents {
  'wave:received': (e: WaveReceivedEvent) => void;
  'presence:delta': (e: PresenceDelta) => void;
  'chat:message': (e: ChatMessageEvent) => void;
  'conversation:opened': (e: ConversationOpenedEvent) => void;
  /** Server-side rate limit, validation error, or unrecoverable socket error. */
  'error:event': (e: { code: string; message: string }) => void;
}

// ─── Client → Server ───────────────────────────────────────────────────────

export type AckResult<T> =
  | { ok: true; data: T }
  | { ok: false; code: string; message: string };

export interface PresenceUpdatePayload {
  location: LatLng;
  /** Compass heading in degrees, optional — used for directional avatars. */
  heading?: number;
  /** Which entity kinds the user is "looking for" in this session. Influences ranking. */
  intent?: EntityKind[];
}

export interface ChatSendPayload {
  conversationId: string;
  body: string;
  /** Client-generated id for optimistic UI; server echoes it in the ack. */
  clientMessageId: string;
}

export interface ClientToServerEvents {
  'presence:update': (
    p: PresenceUpdatePayload,
    ack: (r: AckResult<{ cellId: string }>) => void,
  ) => void;
  'conversation:join': (
    p: { conversationId: string },
    ack: (r: AckResult<{ joined: true }>) => void,
  ) => void;
  'chat:typing': (p: { conversationId: string }) => void;
  'chat:send': (
    p: ChatSendPayload,
    ack: (r: AckResult<ChatMessageEvent>) => void,
  ) => void;
}

// Optional: socket data attached after auth handshake
export interface SocketData {
  userId: string;
  /** Set when the gateway joins the socket to user/cell-scoped rooms. */
  rooms: Set<string>;
}
