import type { ConversationSummary } from '@g88/shared';

function activityAt(conversation: ConversationSummary): number {
  if (!conversation.lastMessageAt) return 0;
  const parsed = Date.parse(conversation.lastMessageAt);
  return Number.isNaN(parsed) ? 0 : parsed;
}

/** Keep mobile ordering aligned with ChatService.findConversations(). */
export function compareConversationSummaries(
  a: ConversationSummary,
  b: ConversationSummary,
): number {
  const aFriend = a.isFriend === true ? 1 : 0;
  const bFriend = b.isFriend === true ? 1 : 0;
  if (aFriend !== bFriend) return bFriend - aFriend;

  if (aFriend === 1) {
    const aOnline = a.peerOnline === true ? 1 : 0;
    const bOnline = b.peerOnline === true ? 1 : 0;
    if (aOnline !== bOnline) return bOnline - aOnline;
  }

  return activityAt(b) - activityAt(a);
}
