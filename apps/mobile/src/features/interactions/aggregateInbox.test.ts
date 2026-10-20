import type { InboxItem } from '@g88/shared';

import { aggregateInbox, aggregatedSignalLabel } from './aggregateInbox';

function item(overrides: Partial<InboxItem> & Pick<InboxItem, 'id' | 'type' | 'createdAt'>): InboxItem {
  return {
    fromUser: { id: 'peer', displayName: 'Peer', avatarUrl: null },
    ...overrides,
  };
}

describe('aggregateInbox', () => {
  it('treats match as first-class activity and prioritizes it over gift and wave', () => {
    const rows = aggregateInbox([
      item({ id: 'wave:1', type: 'wave', createdAt: '2026-10-20T12:00:00.000Z' }),
      item({
        id: 'gift:1',
        type: 'gift',
        createdAt: '2026-10-20T11:00:00.000Z',
        gift: { emoji: '🎁', label: 'Gift', message: null },
      }),
      item({
        id: 'match:1',
        type: 'match',
        createdAt: '2026-10-20T10:00:00.000Z',
        isMutual: true,
        match: { conversationId: 'c1' },
      }),
    ]);

    expect(rows).toHaveLength(1);
    expect(rows[0]?.primary.type).toBe('match');
    expect(rows[0]?.count).toBe(3);
    expect(rows[0]?.latestAt).toBe('2026-10-20T12:00:00.000Z');
  });

  it('keeps friend request as the highest-priority actionable signal', () => {
    const rows = aggregateInbox([
      item({ id: 'match:1', type: 'match', createdAt: '2026-10-20T12:00:00.000Z' }),
      item({ id: 'friend:1', type: 'friend_request', createdAt: '2026-10-20T10:00:00.000Z' }),
    ]);

    expect(rows[0]?.primary.type).toBe('friend_request');
  });

  it('labels matches and gifts explicitly', () => {
    const match = item({
      id: 'match:1',
      type: 'match',
      createdAt: '2026-10-20T12:00:00.000Z',
    });
    const gift = item({
      id: 'gift:1',
      type: 'gift',
      createdAt: '2026-10-20T12:00:00.000Z',
      gift: { emoji: '🌹', label: 'Rose', message: 'Hi' },
    });

    expect(aggregatedSignalLabel(match, 1)).toBe('matched with you');
    expect(aggregatedSignalLabel(gift, 1)).toBe('sent you 🌹 Rose');
    expect(aggregatedSignalLabel(match, 3)).toBe('matched with you · 3×');
  });

  it('sorts actor groups by their latest activity timestamp', () => {
    const rows = aggregateInbox([
      {
        ...item({ id: 'wave:older', type: 'wave', createdAt: '2026-10-20T10:00:00.000Z' }),
        fromUser: { id: 'older', displayName: 'Older', avatarUrl: null },
      },
      {
        ...item({ id: 'wave:newer', type: 'wave', createdAt: '2026-10-20T12:00:00.000Z' }),
        fromUser: { id: 'newer', displayName: 'Newer', avatarUrl: null },
      },
    ]);

    expect(rows.map((row) => row.primary.fromUser.id)).toEqual(['newer', 'older']);
  });
});
