import type { ConversationSummary } from '@g88/shared';

import { compareConversationSummaries } from './conversationSort';

function conversation(
  id: string,
  options: {
    isFriend?: boolean;
    peerOnline?: boolean | null;
    lastMessageAt?: string | null;
  } = {},
): ConversationSummary {
  return {
    id,
    participantIds: [],
    participants: [],
    lastMessageAt: options.lastMessageAt ?? null,
    lastMessage: null,
    status: 'accepted',
    initiatedBy: null,
    isFriend: options.isFriend ?? false,
    peerOnline: options.peerOnline ?? null,
    unreadCount: 0,
  };
}

describe('compareConversationSummaries', () => {
  it('keeps friends ahead of non-friends even when the non-friend is newer', () => {
    const rows = [
      conversation('non-friend', { lastMessageAt: '2026-10-26T11:00:00Z' }),
      conversation('friend', { isFriend: true, lastMessageAt: '2026-10-26T10:00:00Z' }),
    ];

    expect(rows.sort(compareConversationSummaries).map((row) => row.id)).toEqual([
      'friend',
      'non-friend',
    ]);
  });

  it('keeps online friends ahead of offline friends', () => {
    const rows = [
      conversation('offline', {
        isFriend: true,
        peerOnline: false,
        lastMessageAt: '2026-10-26T11:00:00Z',
      }),
      conversation('online', {
        isFriend: true,
        peerOnline: true,
        lastMessageAt: '2026-10-26T10:00:00Z',
      }),
    ];

    expect(rows.sort(compareConversationSummaries).map((row) => row.id)).toEqual([
      'online',
      'offline',
    ]);
  });

  it('uses newest activity within the same friend/online tier', () => {
    const rows = [
      conversation('older', { lastMessageAt: '2026-10-26T10:00:00Z' }),
      conversation('newer', { lastMessageAt: '2026-10-26T11:00:00Z' }),
    ];

    expect(rows.sort(compareConversationSummaries).map((row) => row.id)).toEqual([
      'newer',
      'older',
    ]);
  });

  it('treats missing or invalid activity timestamps as oldest', () => {
    const rows = [
      conversation('missing'),
      conversation('invalid', { lastMessageAt: 'not-a-date' }),
      conversation('valid', { lastMessageAt: '2026-10-26T11:00:00Z' }),
    ];

    expect(rows.sort(compareConversationSummaries)[0]?.id).toBe('valid');
  });
});
