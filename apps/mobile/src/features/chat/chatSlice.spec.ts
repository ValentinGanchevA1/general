import reducer, {
  fetchConversations,
  messageSentOptimistic,
  messageReceived,
  messageConfirmed,
} from './chatSlice';

import type { ChatMessage, ConversationSummary } from '@g88/shared';

const convoId = 'c1';
const me = 'me';
const peer = 'peer';

function msg(
  id: string,
  body = 'hi',
  createdAt = '2026-06-14T00:00:00Z',
  senderId = me,
): ChatMessage {
  return {
    id,
    conversationId: convoId,
    senderId,
    body,
    type: 'text',
    createdAt,
  };
}

function conversation(): ConversationSummary {
  return {
    id: convoId,
    participantIds: [me, peer],
    participants: [],
    unreadCount: 0,
    lastMessage: { senderId: peer, body: 'latest' },
    lastMessageAt: '2026-06-14T00:00:10Z',
    status: 'accepted',
    initiatedBy: peer,
    peerOnline: false,
    isFriend: false,
  };
}

describe('chatSlice.messageConfirmed', () => {
  it('replaces the optimistic message with the confirmed one (ack-first path)', () => {
    let state = reducer(undefined, messageSentOptimistic(msg('opt-1')));
    state = reducer(state, messageConfirmed({ optimisticId: 'opt-1', confirmed: msg('srv-1') }));

    const list = state.messages[convoId] ?? [];
    expect(list).toHaveLength(1);
    expect(list[0]?.id).toBe('srv-1');
  });

  it('does NOT duplicate when the broadcast beats the ack (race)', () => {
    let state = reducer(undefined, messageSentOptimistic(msg('opt-1')));
    state = reducer(state, messageReceived(msg('srv-1')));
    state = reducer(state, messageConfirmed({ optimisticId: 'opt-1', confirmed: msg('srv-1') }));

    const list = state.messages[convoId] ?? [];
    const ids = list.map((m) => m.id);
    expect(ids).toEqual(['srv-1']);
    expect(new Set(ids).size).toBe(ids.length);
  });
});

describe('chatSlice.messageReceived realtime ordering', () => {
  function seededState() {
    return reducer(undefined, fetchConversations.fulfilled([conversation()], 'seed', undefined));
  }

  it('is idempotent for duplicate socket delivery and does not double unread', () => {
    const incoming = { ...msg('srv-peer', 'new', '2026-06-14T00:00:20Z', peer), viewerId: me };
    let state = reducer(seededState(), messageReceived(incoming));
    state = reducer(state, messageReceived(incoming));

    expect(state.messages[convoId]).toHaveLength(1);
    expect(state.conversations[0]?.unreadCount).toBe(1);
  });

  it('does not let an older out-of-order event regress the conversation preview', () => {
    const older = { ...msg('srv-old', 'older', '2026-06-14T00:00:05Z', peer), viewerId: me };
    const state = reducer(seededState(), messageReceived(older));

    expect(state.conversations[0]?.lastMessage).toEqual({ senderId: peer, body: 'latest' });
    expect(state.conversations[0]?.lastMessageAt).toBe('2026-06-14T00:00:10Z');
    expect(state.conversations[0]?.unreadCount).toBe(1);
  });

  it('keeps message history newest-first when an older event arrives late', () => {
    const newer = { ...msg('srv-new', 'newer', '2026-06-14T00:00:20Z', peer), viewerId: me };
    const older = { ...msg('srv-old', 'older', '2026-06-14T00:00:05Z', peer), viewerId: me };
    let state = reducer(seededState(), messageReceived(newer));
    state = reducer(state, messageReceived(older));

    expect((state.messages[convoId] ?? []).map((message) => message.id)).toEqual([
      'srv-new',
      'srv-old',
    ]);
    expect(state.conversations[0]?.lastMessage).toEqual({ senderId: peer, body: 'newer' });
    expect(state.conversations[0]?.lastMessageAt).toBe('2026-06-14T00:00:20Z');
  });
});
