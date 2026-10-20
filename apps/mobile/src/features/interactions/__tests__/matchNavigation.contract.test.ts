import type { InboxItem } from '@g88/shared';

describe('match inbox contract', () => {
  it('carries the conversation id required for direct chat navigation', () => {
    const match: InboxItem = {
      id: 'match:conversation-1',
      type: 'match',
      createdAt: '2026-10-20T12:00:00.000Z',
      fromUser: { id: 'peer', displayName: 'Peer', avatarUrl: null },
      isMutual: true,
      match: { conversationId: 'conversation-1' },
    };

    expect(match.match?.conversationId).toBe('conversation-1');
  });
});
