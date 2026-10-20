import type { ConversationSummary, InboxItem } from '@g88/shared';

export interface InteractionsBadgeCounts {
  activity: number;
  chats: number;
  total: number;
}

export function countUnseenActivity(items: readonly InboxItem[], seenAtMs: number): number {
  return items.reduce((count, item) => {
    const createdAtMs = new Date(item.createdAt).getTime();
    return Number.isFinite(createdAtMs) && createdAtMs > seenAtMs ? count + 1 : count;
  }, 0);
}

export function countUnreadChats(conversations: readonly ConversationSummary[]): number {
  return conversations.reduce(
    (count, conversation) => count + Math.max(0, conversation.unreadCount ?? 0),
    0,
  );
}

export function interactionsBadgeCounts(
  items: readonly InboxItem[],
  conversations: readonly ConversationSummary[],
  seenAtMs: number,
): InteractionsBadgeCounts {
  const activity = countUnseenActivity(items, seenAtMs);
  const chats = countUnreadChats(conversations);
  return { activity, chats, total: activity + chats };
}

export function interactionsBadgeLabel(total: number): string | undefined {
  if (total <= 0) return undefined;
  return total > 99 ? '99+' : String(total);
}
