export type InteractionType = 'chat' | 'wave' | 'follow' | 'match';

export interface InteractionUser {
  id: string;
  displayName: string;
  avatarUrl: string | null;
  isVerified: boolean;
  isOnline: boolean;
}

export interface BaseInteraction {
  id: string;
  type: InteractionType;
  userId: string;
  user: InteractionUser;
  createdAt: string;
  lastActivityAt: string;
  isRead: boolean;
}

export interface ChatInteraction extends BaseInteraction {
  type: 'chat';
  chatId: string;
  lastMessage: {
    id: string;
    text: string;
    sentAt: string;
    isFromMe: boolean;
  };
  unreadCount: number;
}

export interface WaveInteraction extends BaseInteraction {
  type: 'wave';
}

export interface FollowInteraction extends BaseInteraction {
  type: 'follow';
  isFollowingBack: boolean;
}

export interface MatchInteraction extends BaseInteraction {
  type: 'match';
  chatId?: string;
}

export type Interaction =
  | ChatInteraction
  | WaveInteraction
  | FollowInteraction
  | MatchInteraction;

export interface InteractionsResponse {
  items: Interaction[];
  nextCursor: string | null;
}
