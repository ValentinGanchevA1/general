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
  private readonly conversationRefCounts = new Map<string, number>();
  private readonly eventIds = new Set<string>();

  trackConversation(conversationId: string): void {
    const current = this.conversationRefCounts.get(conversationId) ?? 0;
    this.conversationRefCounts.set(conversationId, current + 1);
  }

  /**
   * Release one active consumer. Returns true only when the final reference was
   * removed and the transport may safely leave the connection-scoped room.
   */
  untrackConversation(conversationId: string): boolean {
    const current = this.conversationRefCounts.get(conversationId);
    if (current === undefined) return false;
    if (current <= 1) {
      this.conversationRefCounts.delete(conversationId);
      return true;
    }
    this.conversationRefCounts.set(conversationId, current - 1);
    return false;
  }

  trackEvent(eventId: string): void {
    this.eventIds.add(eventId);
  }

  untrackEvent(eventId: string): void {
    this.eventIds.delete(eventId);
  }

  snapshot(): SocketRoomSnapshot {
    return {
      conversationIds: [...this.conversationRefCounts.keys()],
      eventIds: [...this.eventIds],
    };
  }

  clear(): void {
    this.conversationRefCounts.clear();
    this.eventIds.clear();
  }
}
