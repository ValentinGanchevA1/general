import reducer, {
  messageSentOptimistic,
  messageReceived,
  messageConfirmed,
} from './chatSlice';

import type { ChatMessage } from '@g88/shared';

const convoId = 'c1';
const me = 'me';

function msg(id: string, body = 'hi'): ChatMessage {
  return { id, conversationId: convoId, senderId: me, body, createdAt: '2026-06-14T00:00:00Z' };
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
    // 1. Optimistic insert.
    let state = reducer(undefined, messageSentOptimistic(msg('opt-1')));
    // 2. Server fans chat:message back to the sender BEFORE the ack resolves.
    state = reducer(state, messageReceived(msg('srv-1')));
    // 3. Late ack confirms the same server id.
    state = reducer(state, messageConfirmed({ optimisticId: 'opt-1', confirmed: msg('srv-1') }));

    const list = state.messages[convoId] ?? [];
    const ids = list.map((m) => m.id);
    expect(ids).toEqual(['srv-1']); // optimistic dropped, no duplicate key
    expect(new Set(ids).size).toBe(ids.length);
  });
});
