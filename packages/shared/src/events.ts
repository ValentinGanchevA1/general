import type { LatLng, EntityKind, VerificationLevel } from './api';
import type { EventQuestion, PollResult } from './event';

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

export interface GiftReceivedEvent {
  id: string;
  giftId: string;
  emoji: string;
  label: string;
  message: string | null;
  sender: {
    id: string;
    displayName: string;
    avatarUrl: string | null;
  };
  createdAt: string;
}

export interface AchievementUnlockedEvent {
  id: string;
  title: string;
  description: string;
  icon: string;
  /** Bonus XP paid on unlock (0 = cosmetic only). */
  rewardXp: number;
  unlockedAt: string;
}

// ─── P3.5 Events: live poll / Q&A deltas (room `event:{eventId}`) ─────────────
//
// These are broadcast to *everyone* in an event room, so they carry only the
// state that is shared across viewers. The per-viewer fields — `PollResult.myVote`
// and `EventQuestion.upvotedByMe` — are intentionally omitted; each client keeps
// its own and merges the shared counts on top (see mobile `eventMerge`).

/** A poll snapshot after it was created or a vote was cast. `id` is the poll id. */
export type EventPollDelta = Omit<PollResult, 'myVote'>;

/** A newly-asked question (or an edit to its shared fields). */
export type EventQuestionDelta = Omit<EventQuestion, 'upvotedByMe'>;

/** A question's upvote count changed. */
export interface EventQuestionUpvoteDelta {
  eventId: string;
  questionId: string;
  upvotes: number;
}

export interface ServerToClientEvents {
  'wave:received': (e: WaveReceivedEvent) => void;
  'presence:delta': (e: PresenceDelta) => void;
  'chat:message': (e: ChatMessageEvent) => void;
  'conversation:opened': (e: ConversationOpenedEvent) => void;
  'gift:received': (e: GiftReceivedEvent) => void;
  'achievement:unlocked': (e: AchievementUnlockedEvent) => void;
  /** Poll created or vote tally changed in an event the socket has joined. */
  'event:poll': (e: EventPollDelta) => void;
  /** New question asked in a joined event. */
  'event:question': (e: EventQuestionDelta) => void;
  /** A question's upvote count changed in a joined event. */
  'event:question:upvote': (e: EventQuestionUpvoteDelta) => void;
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
  /** Subscribe to live poll/Q&A deltas for an event (room `event:{eventId}`). */
  'event:join': (
    p: { eventId: string },
    ack: (r: AckResult<{ joined: true }>) => void,
  ) => void;
  /** Unsubscribe from an event's live deltas. */
  'event:leave': (
    p: { eventId: string },
    ack: (r: AckResult<{ left: true }>) => void,
  ) => void;
}

// Optional: socket data attached after auth handshake
export interface SocketData {
  userId: string;
  /** Set when the gateway joins the socket to user/cell-scoped rooms. */
  rooms: Set<string>;
}
