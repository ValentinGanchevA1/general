export type GroupConversationRole = 'owner' | 'admin' | 'member';

export interface CreateGroupConversationRequest {
  title: string;
  /** Invited members only. The authenticated creator is added as owner server-side. */
  memberUserIds: string[];
}

/**
 * Privacy-minimal group list row. Member identities are intentionally omitted
 * until group block/removal semantics and participant disclosure policy ship.
 */
export interface GroupConversationSummary {
  id: string;
  title: string;
  role: GroupConversationRole;
  muted: boolean;
  memberCount: number;
  lastMessageAt: string | null;
  createdAt: string;
}

export type CreateGroupConversationResponse = GroupConversationSummary;
