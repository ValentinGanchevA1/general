export interface SocketRoomSnapshot {
  conversationIds: string[];
  eventIds: string[];
}

/**
 * Client-side room intent for the current authenticated socket session.
 * Socket.IO room membership itself is connection-scoped, so this registry is
 * replayed after reconnects and cleared on logout.
 *
 * Storage is session-global because the app owns one shared Socket.IO singleton.
 * Separate consumers may therefore release the same room intent safely.
 */
export class SocketRoomRegistry {
  private static readonly conversationIds = new Set<string>();
  private static readonly eventIds = new Set<string>();

  trackConversation(conversationId: string): void {
    SocketRoomRegistry.conversationIds.add(conversationId);
  }

  untrackConversation(conversationId: string): void {
    SocketRoomRegistry.conversationIds.delete(conversationId);
  }

  trackEvent(eventId: string): void {
    SocketRoomRegistry.eventIds.add(eventId);
  }

  untrackEvent(eventId: string): void {
    SocketRoomRegistry.eventIds.delete(eventId);
  }

  snapshot(): SocketRoomSnapshot {
    return {
      conversationIds: [...SocketRoomRegistry.conversationIds],
      eventIds: [...SocketRoomRegistry.eventIds],
    };
  }

  clear(): void {
    SocketRoomRegistry.conversationIds.clear();
    SocketRoomRegistry.eventIds.clear();
  }
}
