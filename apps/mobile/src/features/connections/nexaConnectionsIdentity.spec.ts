import type { InboxItem } from '@g88/shared';

import {
  connectionsEmptyCopy,
  formatConnectionsBadge,
  isActionableConnectionActivity,
} from './nexaConnectionsIdentity';

function item(overrides: Partial<InboxItem>): InboxItem {
  return {
    id: 'i-1',
    type: 'wave',
    createdAt: '2026-10-21T00:00:00.000Z',
    fromUser: {
      id: 'u-1',
      displayName: 'Alex',
      avatarUrl: null,
    },
    ...overrides,
  };
}

describe('NEXA Connections identity', () => {
  it('counts only activity with a direct relationship action as actionable', () => {
    expect(isActionableConnectionActivity(item({ type: 'wave', isMutual: false }))).toBe(true);
    expect(isActionableConnectionActivity(item({ type: 'wave', isMutual: true }))).toBe(false);
    expect(
      isActionableConnectionActivity(item({ type: 'friend_request', requestId: 'r-1' })),
    ).toBe(true);
    expect(isActionableConnectionActivity(item({ type: 'follow', isFollowingBack: false }))).toBe(true);
    expect(isActionableConnectionActivity(item({ type: 'follow', isFollowingBack: true }))).toBe(false);
    expect(isActionableConnectionActivity(item({ type: 'gift' }))).toBe(false);
  });

  it('caps numeric chat badges without creating a zero badge', () => {
    expect(formatConnectionsBadge(0)).toBeNull();
    expect(formatConnectionsBadge(7)).toBe('7');
    expect(formatConnectionsBadge(100)).toBe('99+');
  });

  it('keeps empty states map-first', () => {
    expect(connectionsEmptyCopy('activity').actionLabel).toBe('Discover nearby');
    expect(connectionsEmptyCopy('chats').actionLabel).toBe('Discover people');
  });
});
