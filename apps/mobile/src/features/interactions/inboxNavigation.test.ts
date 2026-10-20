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

  it('opens friend-accepted notification on its typed profile destination', () => {
    expect(inboxDestination(item({
      type: 'notification',
      notification: {
        kind: 'friend_accepted',
        destination: { type: 'profile', userId: 'peer-2' },
      },
    }))).toEqual({ kind: 'profile', userId: 'peer-2' });
  });

  it('supports event, listing, and chat notification destinations', () => {
    expect(inboxDestination(item({
      type: 'notification',
      notification: { kind: 'mention', destination: { type: 'event', eventId: 'event-1' } },
    }))).toEqual({ kind: 'event', eventId: 'event-1' });

    expect(inboxDestination(item({
      type: 'notification',
      notification: { kind: 'mention', destination: { type: 'listing', listingId: 'listing-1' } },
    }))).toEqual({ kind: 'listing', listingId: 'listing-1' });

    expect(inboxDestination(item({
      type: 'notification',
      notification: { kind: 'mention', destination: { type: 'chat', conversationId: 'chat-1' } },
    }))).toEqual({
      kind: 'chat',
      conversationId: 'chat-1',
      otherUserId: 'peer-1',
      otherUserName: 'Peer',
    });
  });

  it('falls back to the actor profile for an unusable notification destination', () => {
    expect(inboxDestination(item({
      type: 'notification',
      notification: {
        kind: 'mention',
        destination: { type: 'event', eventId: '   ' },
      },
    }))).toEqual({ kind: 'profile', userId: 'peer-1' });
  });
});
