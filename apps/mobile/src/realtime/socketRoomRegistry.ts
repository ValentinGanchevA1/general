export interface SocketRoomSnapshot {
  conversationIds: string[];
  eventIds: string[];
}

/**
 * Client-side room intent for the current authenticated socket session.
 * Socket.IO room membership itself is connection-scoped, so this registry is
 * replayed after reconnects and cleared on logout.
 */
export class SocketRoomRegistry {
  private readonly conversationIds = new Set<string>();
  private readonly eventIds = new Set<string>();

  trackConversation(conversationId: string): void {
    this.conversationIds.add(conversationId);
  }

  trackEvent(eventId: string): void {
    this.eventIds.add(eventId);
  }

  untrackEvent(eventId: string): void {
    this.eventIds.delete(eventId);
  }

  snapshot(): SocketRoomSnapshot {
    return {
      conversationIds: [...this.conversationIds],
      eventIds: [...this.eventIds],
    };
  }

  clear(): void {
    this.conversationIds.clear();
    this.eventIds.clear();
  }
}
