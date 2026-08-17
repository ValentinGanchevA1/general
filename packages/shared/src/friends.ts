// packages/shared/src/friends.ts
// Two-tier social graph contracts (follows + close friends).
//
// Product rules (2026-08-17):
// - Unfriend keeps mutual follows (friendship row only is deleted).
// - Follow is independent of friendship: you can unfollow while still friends.

export type FriendRequestStatus = 'pending' | 'accepted' | 'declined' | 'cancelled';

/** Close friend or follow edge as shown in list UIs. */
export interface FriendCard {
  userId: string;
  displayName: string;
  avatarUrl: string | null;
  /** null when the friend's privacy hides online status from friends. */
  online: boolean | null;
  createdAt: string;
}

export interface FriendRequestCard {
  id: string;
  fromUserId: string;
  displayName: string;
  avatarUrl: string | null;
  createdAt: string;
}

/** Relationship of the viewer toward a public profile target. */
export type RelationshipState =
  | 'none'
  | 'following'
  | 'followed_by'
  | 'mutual_follow'
  | 'friends'
  | 'request_outgoing'
  | 'request_incoming';

export interface RelationshipSummary {
  state: RelationshipState;
  /** Pending request id when state is request_outgoing or request_incoming. */
  requestId?: string;
  /** Mutual friends count (friends of both viewer and target). */
  mutualFriendsCount: number;
  /** Viewer follows target (independent of friendship). */
  isFollowing: boolean;
  /** Target follows viewer (independent of friendship). */
  isFollowedBy: boolean;
}

export interface FollowRequest {
  userId: string;
}

export interface CreateFriendRequestBody {
  userId: string;
}

export interface FriendsPage {
  items: FriendCard[];
  nextCursor: string | null;
}

export interface FriendRequestsPage {
  items: FriendRequestCard[];
  nextCursor: string | null;
}

/** Why a user appears in friend suggestions. */
export type SuggestionReason = 'mutual_friends' | 'recent_wave' | 'recent_chat';

/** Ranked "people you may know" card. */
export interface SuggestionCard {
  userId: string;
  displayName: string;
  avatarUrl: string | null;
  mutualFriendsCount: number;
  reason: SuggestionReason;
  /** Viewer already follows this user. */
  isFollowing: boolean;
  /** Outgoing pending friend request exists. */
  hasPendingOutgoing: boolean;
  /** Incoming pending friend request exists. */
  hasPendingIncoming: boolean;
}
