import type { InboxItem } from '@g88/shared';

export type InboxDestination =
  | { kind: 'chat'; conversationId: string; otherUserId: string; otherUserName: string }
  | { kind: 'profile'; userId: string };

export function inboxDestination(item: InboxItem): InboxDestination {
  const conversationId = item.type === 'match' ? item.match?.conversationId?.trim() : undefined;
  if (conversationId) {
    return {
      kind: 'chat',
      conversationId,
      otherUserId: item.fromUser.id,
      otherUserName: item.fromUser.displayName,
    };
  }

  return { kind: 'profile', userId: item.fromUser.id };
}
