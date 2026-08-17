import type {
  LatLng,
  EntityKind,
  VerificationLevel,
  ChatLocation,
  ChatMessage,
  ChatMessageType,
  LocationShareDuration,
  LocationShareEndReason,
  LocationShareSession,
} from './api';
import type { EventQuestion, PollResult } from './event';
import type { StoryNewEvent } from './story';

// ─── Server → Client ─────────────────────────────────────────────────────

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

/** Close-friend online change (room `user:{friendId}`). */
export interface FriendPresenceEvent {
  userId: string;
  online: boolean;
}

/** Incoming friend request (room `user:{addresseeId}`). */
export interface FriendRequestEvent {
  requestId: string;
  fromUser: {
    id: string;
    displayName: string;
    avatarUrl: string | null;
  };
  createdAt: string;
  /** Current pending incoming count for the recipient (for badge). */
  pendingCount: number;
}

/** Friend request accepted — delivered to the original requester. */
export interface FriendAcceptedEvent {
  peerUserId: string;
  peerDisplayName: string;
  peerAvatarUrl: string | null;
  acceptedAt: string;
}

export interface ChatMessageEvent {
  id: string;
  conversationId: string;
  senderId: string;
  body: string;
  type: ChatMessageType;
  location?: ChatLocation | null;
  locationSessionId?: string | null;
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

// ─── Live location share ───────────────────────────────────────────────────

export interface LocationShareStartedEvent {
  session: LocationShareSession;
  message: ChatMessage;
}

export interface LocationShareUpdateEvent {
  sessionId: string;
  conversationId: string;
  location: ChatLocation;
  updatedAt: string;
}

export interface LocationShareEndedEvent {
  sessionId: string;
  conversationId: string;
  reason: LocationShareEndReason;
  endedAt: string;
}

// ─── P3.5 Events: live poll / Q&A deltas (room `event:{eventId}`) ─────────────

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
  /** A close friend went online/offline (delivered to each friend's user room). */
  'friend:presence': (e: FriendPresenceEvent) => void;
  /** Someone sent you a friend request. */
  'friend:request': (e: FriendRequestEvent) => void;
  /** Your friend request was accepted. */
  'friend:accepted': (e: FriendAcceptedEvent) => void;
  'chat:message': (e: ChatMessageEvent) => void;
  'conversation:opened': (e: ConversationOpenedEvent) => void;
  'gift:received': (e: GiftReceivedEvent) => void;
  'achievement:unlocked': (e: AchievementUnlockedEvent) => void;
  'location:share:started': (e: LocationShareStartedEvent) => void;
  'location:share:update': (e: LocationShareUpdateEvent) => void;
  'location:share:ended': (e: LocationShareEndedEvent) => void;
  /** Poll created or vote tally changed in an event the socket has joined. */
  'event:poll': (e: EventPollDelta) => void;
  /** New question asked in a joined event. */
  'event:question': (e: EventQuestionDelta) => void;
  /** A question's upvote count changed in a joined event. */
  'event:question:upvote': (e: EventQuestionUpvoteDelta) => void;
  /** A new story was posted into a cell the socket is present in. */
  'story:new': (e: StoryNewEvent) => void;
  /** Server-side rate limit, validation error, or unrecoverable socket error. */
  'error:event': (e: { code: string; message: string }) => void;
}

// ─── Client → Server ─────────────────────────────────────────────────────

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

export interface LocationShareStartPayload {
  conversationId: string;
  duration: LocationShareDuration;
  location: ChatLocation;
}

export interface LocationShareUpdatePayload {
  sessionId: string;
  location: ChatLocation;
}

export interface LocationShareStopPayload {
  sessionId: string;
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
  'location:share:start': (
    p: LocationShareStartPayload,
    ack: (r: AckResult<LocationShareSession>) => void,
  ) => void;
  'location:share:update': (
    p: LocationShareUpdatePayload,
    ack: (r: AckResult<{ updatedAt: string }>) => void,
  ) => void;
  'location:share:stop': (
    p: LocationShareStopPayload,
    ack: (r: AckResult<{ ended: true }>) => void,
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
  /** True after first successful presence:update this connection (friend online fan-out). */
  friendPresenceAnnounced?: boolean;
}
