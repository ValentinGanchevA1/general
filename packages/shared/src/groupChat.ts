import type { ConversationParticipant } from './api';

export type GroupConversationMemberRole = 'owner' | 'admin' | 'member';

export interface GroupConversationMember extends ConversationParticipant {
  role: GroupConversationMemberRole;
}

export interface GroupConversationSummary {
  id: string;
  kind: 'group';
  title: string;
  createdBy: string | null;
  members: GroupConversationMember[];
  lastMessageAt: string | null;
  lastMessage: { senderId: string; body: string } | null;
  unreadCount: number;
}

/**
 * `memberIds` contains invitees only; the authenticated creator is added as owner.
 * `clientRequestId` makes create retries safe without deduplicating legitimate groups
 * that happen to use the same title/member set.
 */
export interface CreateGroupConversationRequest {
  clientRequestId: string;
  title: string;
  memberIds: string[];
}

export interface CreateGroupConversationResponse {
  conversation: GroupConversationSummary;
  reused: boolean;
}
