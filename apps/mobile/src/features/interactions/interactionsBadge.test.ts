import type { ConversationSummary, InboxItem } from '@g88/shared';

import {
  countUnreadChats,
  countUnseenActivity,
  interactionsBadgeCounts,
  interactionsBadgeLabel,
} from './interactionsBadge';

const user = {
  id: 'peer-1',
  displayName: 'Peer',
  avatarUrl: null,
  verification: 'none' as const,
};

const activity = (id: string, createdAt: string): InboxItem => ({
  id,
  type: 'wave',
  createdAt,
  fromUser: user,
});

const conversation = (id: string, unreadCount: number): ConversationSummary => ({
  id,
  status: 'accepted',
  participants: [],
  unreadCount,
  lastMessage: null,
  lastMessageAt: null,
  peerOnline: false,
  isFriend: false,
});

describe('interactionsBadge', () => {
  it('counts only activity newer than the explicit seen watermark', () => {
    const items = [
      activity('new', '2026-10-20T10:00:01.000Z'),
      activity('equal', '2026-10-20T10:00:00.000Z'),
      activity('old', '2026-10-20T09:59:59.000Z'),
    ];

    expect(countUnseenActivity(items, Date.parse('2026-10-20T10:00:00.000Z'))).toBe(1);
  });

  it('ignores malformed activity timestamps', () => {
    expect(countUnseenActivity([activity('bad', 'not-a-date')], 0)).toBe(0);
  });

  it('sums unread message counts without treating negative values as unread', () => {
    expect(
      countUnreadChats([
        conversation('a', 2),
        conversation('b', 3),
        conversation('c', -1),
      ]),
    ).toBe(5);
  });

  it('combines unseen activity and unread chats without cross-category dedupe', () => {
    const counts = interactionsBadgeCounts(
      [activity('new', '2026-10-20T10:00:01.000Z')],
      [conversation('a', 2)],
      Date.parse('2026-10-20T10:00:00.000Z'),
    );

    expect(counts).toEqual({ activity: 1, chats: 2, total: 3 });
  });

  it('formats the visual badge with a 99+ cap', () => {
    expect(interactionsBadgeLabel(0)).toBeUndefined();
    expect(interactionsBadgeLabel(8)).toBe('8');
    expect(interactionsBadgeLabel(99)).toBe('99');
    expect(interactionsBadgeLabel(100)).toBe('99+');
  });
});
