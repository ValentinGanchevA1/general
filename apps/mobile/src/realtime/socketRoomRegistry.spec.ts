import { SocketRoomRegistry } from './socketRoomRegistry';

describe('SocketRoomRegistry', () => {
  it('tracks conversation and event room intents without duplicates', () => {
    const registry = new SocketRoomRegistry();
    registry.trackConversation('conversation-1');
    registry.trackConversation('conversation-1');
    registry.trackEvent('event-1');
    registry.trackEvent('event-1');

    expect(registry.snapshot()).toEqual({
      conversationIds: ['conversation-1'],
      eventIds: ['event-1'],
    });
  });

  it('untracks an event even when no socket leave can be emitted', () => {
    const registry = new SocketRoomRegistry();
    registry.trackEvent('event-1');
    registry.untrackEvent('event-1');

    expect(registry.snapshot().eventIds).toEqual([]);
  });

  it('clears all room intents on logout', () => {
    const registry = new SocketRoomRegistry();
    registry.trackConversation('conversation-1');
    registry.trackEvent('event-1');

    registry.clear();

    expect(registry.snapshot()).toEqual({
      conversationIds: [],
      eventIds: [],
    });
  });
});
