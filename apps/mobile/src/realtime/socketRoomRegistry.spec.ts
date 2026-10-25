import { SocketRoomRegistry } from './socketRoomRegistry';

describe('SocketRoomRegistry', () => {
  beforeEach(() => {
    new SocketRoomRegistry().clear();
  });

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

  it('shares session-global storage across registry consumers', () => {
    const writer = new SocketRoomRegistry();
    const reader = new SocketRoomRegistry();

    writer.trackConversation('conversation-1');
    writer.trackEvent('event-1');

    expect(reader.snapshot()).toEqual({
      conversationIds: ['conversation-1'],
      eventIds: ['event-1'],
    });
  });

  it('untracks a conversation from another consumer', () => {
    const tracker = new SocketRoomRegistry();
    const cleanup = new SocketRoomRegistry();

    tracker.trackConversation('conversation-1');
    cleanup.untrackConversation('conversation-1');

    expect(tracker.snapshot().conversationIds).toEqual([]);
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
