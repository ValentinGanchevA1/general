import type { InboxItem } from '@g88/shared';

import { aggregateInbox, aggregatedSignalLabel } from './aggregateInbox';

function item(overrides: Partial<InboxItem> & Pick<InboxItem, 'id' | 'type' | 'createdAt'>): InboxItem {
  return {
    fromUser: { id: 'peer', displayName: 'Peer', avatarUrl: null },
    ...overrides,
  };
}

describe('aggregateInbox', () => {
  it('keeps different activity types from the same actor as distinct rows', () => {
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

    expect(rows).toHaveLength(3);
    expect(rows.map((row) => row.primary.type)).toEqual(['wave', 'gift', 'match']);
    expect(rows.map((row) => row.latestAt)).toEqual([
      '2026-10-20T12:00:00.000Z',
      '2026-10-20T11:00:00.000Z',
      '2026-10-20T10:00:00.000Z',
    ]);
    expect(rows.every((row) => row.count === 1)).toBe(true);
  });

  it('aggregates repeated signals only when actor and type both match', () => {
    const rows = aggregateInbox([
      item({ id: 'wave:1', type: 'wave', createdAt: '2026-10-20T10:00:00.000Z' }),
      item({ id: 'wave:2', type: 'wave', createdAt: '2026-10-20T12:00:00.000Z' }),
    ]);

    expect(rows).toHaveLength(1);
    expect(rows[0]?.primary.id).toBe('wave:2');
    expect(rows[0]?.count).toBe(2);
    expect(rows[0]?.latestAt).toBe('2026-10-20T12:00:00.000Z');
  });

  it('labels matches, gifts, and durable personal notifications explicitly', () => {
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
    const accepted = item({
      id: 'notification:1',
      type: 'notification',
      createdAt: '2026-10-20T12:00:00.000Z',
      notification: {
        kind: 'friend_accepted',
        destination: { type: 'profile', userId: 'peer' },
      },
    });
    const mention = item({
      id: 'notification:2',
      type: 'notification',
      createdAt: '2026-10-20T12:00:00.000Z',
      notification: {
        kind: 'mention',
        destination: { type: 'event', eventId: 'event-1' },
      },
    });

    expect(aggregatedSignalLabel(match, 1)).toBe('matched with you');
    expect(aggregatedSignalLabel(gift, 1)).toBe('sent you 🌹 Rose');
    expect(aggregatedSignalLabel(accepted, 1)).toBe('accepted your friend request');
    expect(aggregatedSignalLabel(mention, 1)).toBe('mentioned you');
    expect(aggregatedSignalLabel(match, 3)).toBe('matched with you · 3×');
  });

  it('sorts groups by their actual latest activity timestamp', () => {
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
