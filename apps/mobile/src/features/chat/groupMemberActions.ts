import type { GroupConversationMemberRole } from '@g88/shared';

export type GroupMemberAction = 'leave' | 'remove' | null;

export function resolveGroupMemberAction(
  viewerId: string,
  viewerRole: GroupConversationMemberRole,
  targetId: string,
  targetRole: GroupConversationMemberRole,
): GroupMemberAction {
  if (viewerId === targetId) return 'leave';
  if (viewerRole === 'owner' && targetRole !== 'owner') return 'remove';
  if (viewerRole === 'admin' && targetRole === 'member') return 'remove';
  return null;
}
