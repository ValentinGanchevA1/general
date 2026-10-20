import type { InboxItem } from '@g88/shared';

import { inboxDestination } from './inboxNavigation';

function item(overrides: Partial<InboxItem>): InboxItem {
  return {
    id: 'activity-1',
    type: 'wave',
    createdAt: '2026-10-20T12:00:00.000Z',
    fromUser: { id: 'peer-1', displayName: 'Peer', avatarUrl: null },
    ...overrides,
  };
}

describe('inboxDestination', () => {
  it('opens a first-class match in its canonical conversation', () => {
    expect(
      inboxDestination(
        item({ type: 'match', match: { conversationId: 'conversation-1' } }),
      ),
    ).toEqual({
      kind: 'chat',
      conversationId: 'conversation-1',
      otherUserId: 'peer-1',
      otherUserName: 'Peer',
    });
  });

  it('keeps non-match activity on profile navigation', () => {
    expect(inboxDestination(item({ type: 'gift' }))).toEqual({
      kind: 'profile',
      userId: 'peer-1',
    });
  });

  it('falls back safely when a match has no usable conversation id', () => {
    expect(inboxDestination(item({ type: 'match', match: { conversationId: '   ' } }))).toEqual({
      kind: 'profile',
      userId: 'peer-1',
    });
  });
});
