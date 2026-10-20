import type { VerificationLevel } from './users';

export interface FriendRequest {
  id: string;
  requesterId: string;
  addresseeId: string;
  status: 'pending' | 'accepted' | 'declined';
  createdAt: string;
}

export interface FriendRequestUser {
  id: string;
  displayName: string;
  avatarUrl: string | null;
  verification?: VerificationLevel | null;
}

export interface PendingFriendRequest {
  id: string;
  requester: FriendRequestUser;
  createdAt: string;
}

export interface PendingFriendRequestsResponse {
  items: PendingFriendRequest[];
}

export interface FriendRequestActionResponse {
  success: true;
}

export interface FriendRequestCreateResponse {
  request: FriendRequest;
}

export interface FriendRequestCreateRequest {
  userId: string;
}

export interface FollowRequest {
  userId: string;
}

export interface FollowResponse {
  following: true;
}

export interface FriendStatusResponse {
  status: 'none' | 'pending_outgoing' | 'pending_incoming' | 'friends';
  requestId?: string;
}

export interface FriendCard {
  id: string;
  displayName: string;
  avatarUrl: string | null;
  verification?: VerificationLevel | null;
}

export interface FriendsResponse {
  items: FriendCard[];
}

export interface FriendRequestReceivedEvent {
  requestId: string;
  fromUser: FriendRequestUser;
  createdAt: string;
}

export interface FriendRequestAcceptedEvent {
  requestId: string;
  user: FriendRequestUser;
  acceptedAt: string;
}

export interface FriendRequestDeclinedEvent {
  requestId: string;
  userId: string;
  declinedAt: string;
}

export interface FriendRemovedEvent {
  userId: string;
  removedAt: string;
}

/** Lightweight recent follower for the Interactions inbox. */
export interface RecentFollowerCard {
  userId: string;
  displayName: string;
  avatarUrl: string | null;
  createdAt: string;
  /** Viewer already follows this user back. */
  isFollowingBack: boolean;
}

export interface RecentFollowersResponse {
  items: RecentFollowerCard[];
}

/**
 * Unified Interactions inbox item.
 * Backend: GET /interactions/inbox (domain projection).
 * Friends Requests tab still uses /friends/requests/pending.
 */
export type InboxItemType =
  | 'wave'
  | 'match'
  | 'friend_request'
  | 'follow'
  | 'story_reaction'
  | 'gift';

export interface InboxItem {
  id: string;
  type: InboxItemType;
  createdAt: string;
  fromUser: {
    id: string;
    displayName: string;
    avatarUrl: string | null;
    verification?: VerificationLevel | null;
  };
  isMutual?: boolean;
  requestId?: string;
  isFollowingBack?: boolean;
  reactionKind?: 'heart' | 'wave';
  /** Match metadata when type === 'match'. */
  match?: {
    conversationId: string;
  };
  /** Gift metadata when type === 'gift'. */
  gift?: {
    emoji: string;
    label: string;
    message: string | null;
  };
}

export interface InboxResponse {
  items: InboxItem[];
}
