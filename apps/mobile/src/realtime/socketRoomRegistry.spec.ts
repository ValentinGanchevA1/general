import { SocketRoomRegistry } from './socketRoomRegistry';

describe('SocketRoomRegistry', () => {
  it('reference-counts conversation intents while deduplicating snapshots', () => {
    const registry = new SocketRoomRegistry();
    registry.trackConversation('conversation-1');
    registry.trackConversation('conversation-1');

    expect(registry.snapshot().conversationIds).toEqual(['conversation-1']);

    registry.untrackConversation('conversation-1');
    expect(registry.snapshot().conversationIds).toEqual(['conversation-1']);

    registry.untrackConversation('conversation-1');
    expect(registry.snapshot().conversationIds).toEqual([]);
  });

  it('tracks and untracks event intent without duplicates', () => {
    const registry = new SocketRoomRegistry();
    registry.trackEvent('event-1');
    registry.trackEvent('event-1');
    expect(registry.snapshot().eventIds).toEqual(['event-1']);

    registry.untrackEvent('event-1');
    expect(registry.snapshot().eventIds).toEqual([]);
  });

  it('ignores conversation releases that were never retained', () => {
    const registry = new SocketRoomRegistry();
    registry.untrackConversation('conversation-1');
    expect(registry.snapshot().conversationIds).toEqual([]);
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
