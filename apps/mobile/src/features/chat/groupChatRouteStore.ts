import type { GroupConversationSummary } from '@g88/shared';

let pendingGroup: GroupConversationSummary | null = null;

export const groupChatRouteStore = {
  set(group: GroupConversationSummary): void {
    pendingGroup = group;
  },

  take(conversationId: string): GroupConversationSummary | null {
    if (pendingGroup?.id !== conversationId) return null;
    const group = pendingGroup;
    pendingGroup = null;
    return group;
  },

  clear(): void {
    pendingGroup = null;
  },
};
