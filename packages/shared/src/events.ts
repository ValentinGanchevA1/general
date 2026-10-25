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
  EntityPoint,
  DiscoveryPointKey,
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

/** Reciprocal wave — both participants; pin machine uses for WAVE_MUTUAL. */
export interface WaveMutualEvent {
  peerUserId: string;
  conversationId: string;
  waveId: string;
  createdAt: string;
}

/** One-way dating like received (no match yet). */
export interface DatingLikeReceivedEvent {
  likeId: string;
  fromUser: {
    id: string;
    displayName: string;
    avatarUrl: string | null;
  };
  createdAt: string;
}

/** Mutual dating like — opens dating conversation. */
export interface DatingMatchCreatedEvent {
  peerUserId: string;
  peerDisplayName: string;
  peerAvatarUrl: string | null;
  datingConversationId: string;
  createdAt: string;
}

export interface PresenceDelta {
  cellId: string;
  /** Users that became online in this cell since the last delta. */
  added: Array<{ userId: string; lat: number; lng: number }>;
  /** Users that went offline or moved out of this cell. */
  removed: string[];
}

/**
 * Server-authoritative discovery entity delta. Payloads must already satisfy
 * viewer visibility/privacy rules and use the same sanitized EntityPoint shape
 * returned by /discovery/nearby. Clusters remain query-authoritative.
 */
export interface DiscoveryEntityUpsertEvent {
  point: EntityPoint;
}

export interface DiscoveryEntityLeaveEvent {
  key: DiscoveryPointKey;
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

/** User crossed an XP level threshold. */
export interface LevelUpEvent {
  level: number;
  previousLevel: number;
  totalXp: number;
  xpIntoLevel: number;
  xpForNextLevel: number;
}

/** Daily challenge crossed its target for the first time today. */
export interface ChallengeCompletedEvent {
  challengeId: string;
  title: string;
  rewardXp: number;
  /** Optional emoji; client falls back to ✅. */
  icon?: string;
}

/**
 * Caller improved rank on a leaderboard scope.
 * Emitted client-side today (compare previous fetch); server emit reserved.
 */
export interface LeaderboardRankUpEvent {
  scope: 'weekly' | 'all_time';
  previousRank: number;
  rank: number;
  xp: number;
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
  'wave:mutual': (e: WaveMutualEvent) => void;
  'dating:like_received': (e: DatingLikeReceivedEvent) => void;
  'dating:match_created': (e: DatingMatchCreatedEvent) => void;
  'presence:delta': (e: PresenceDelta) => void;
  /** Sanitized discovery entity entered the viewer's active discovery stream. */
  'discovery:entity:enter': (e: DiscoveryEntityUpsertEvent) => void;
  /** Sanitized discovery entity changed while visible to this viewer. */
  'discovery:entity:update': (e: DiscoveryEntityUpsertEvent) => void;
  /** Discovery entity is no longer visible/in-scope for this viewer. */
  'discovery:entity:leave': (e: DiscoveryEntityLeaveEvent) => void;
  /** A close friend went online/offline (delivered to each friend's user room). */
  'friend:presence': (e: FriendPresenceEvent) => void;
  /** Someone sent you a friend request. */
  'friend:request': (e: FriendRequestEvent) => void;
  /** Your friend request was accepted — delivered to the original requester. */
  'friend:accepted': (e: FriendAcceptedEvent) => void;
  'chat:message': (e: ChatMessageEvent) => void;
  'conversation:opened': (e: ConversationOpenedEvent) => void;
  'gift:received': (e: GiftReceivedEvent) => void;
  'achievement:unlocked': (e: AchievementUnlockedEvent) => void;
  'level:up': (e: LevelUpEvent) => void;
  'challenge:completed': (e: ChallengeCompletedEvent) => void;
  /** Reserved for server-side rank emit; mobile also synthesizes locally. */
  'leaderboard:rank_up': (e: LeaderboardRankUpEvent) => void;
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
  lat: number;
  lng: number;
}

export interface ClientToServerEvents {
  'presence:update': (
    payload: PresenceUpdatePayload,
    ack: (res: AckResult<{ cellId: string }>) => void,
  ) => void;
  'conversation:join': (
    payload: { conversationId: string },
    ack: (res: AckResult<{ conversationId: string }>) => void,
  ) => void;
  'conversation:leave': (
    payload: { conversationId: string },
    ack: (res: AckResult<{ conversationId: string }>) => void,
  ) => void;
  'chat:send': (
    payload: { conversationId: string; body: string; clientMessageId: string },
    ack: (res: AckResult<ChatMessageEvent>) => void,
  ) => void;
  'event:join': (
    payload: { eventId: string },
    ack: (res: AckResult<{ eventId: string }>) => void,
  ) => void;
  'event:leave': (
    payload: { eventId: string },
    ack: (res: AckResult<{ eventId: string }>) => void,
  ) => void;
  'location:share:start': (
    payload: {
      conversationId: string;
      duration: LocationShareDuration;
      location: ChatLocation;
    },
    ack: (res: AckResult<LocationShareStartedEvent>) => void,
  ) => void;
  'location:share:update': (
    payload: { sessionId: string; location: ChatLocation },
    ack: (res: AckResult<{ updatedAt: string }>) => void,
  ) => void;
  'location:share:stop': (
    payload: { sessionId: string },
    ack: (res: AckResult<{ sessionId: string }>) => void,
  ) => void;
}
