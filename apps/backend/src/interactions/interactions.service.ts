import { Injectable } from '@nestjs/common';
import type { Interaction, InteractionsResponse } from '@shared/types/interaction';

/**
 * Unified Interactions hub.
 * - Merges chats (with last message + unread), waves, follows, matches
 * - Filters blocked & deleted users
 * - Sorted by lastActivityAt DESC
 * - Cursor pagination
 *
 * Socket events to emit from chat/wave/follow gateways:
 * - interaction:new
 * - chat:message
 * - user:online / user:offline
 */
@Injectable()
export class InteractionsService {
  // Inject PrismaService / repositories when wiring
  // constructor(private readonly prisma: PrismaService) {}

  async getInteractions(
    userId: string,
    opts: { cursor?: string; limit: number },
  ): Promise<InteractionsResponse> {
    // TODO: implement unified query against chats + waves + follows + matches
    // Exclude blocked/deleted
    // Return sorted by lastActivityAt DESC with cursor
    return {
      items: [],
      nextCursor: null,
    };
  }

  /** Call from chat gateway after message is persisted */
  async emitChatMessage(chatId: string, message: any, recipientId: string) {
    // this.gateway.server.to(`user:${recipientId}`).emit('chat:message', { ... })
  }

  /** Call when wave / follow / match is created */
  async emitNewInteraction(recipientId: string, interaction: Interaction) {
    // this.gateway.server.to(`user:${recipientId}`).emit('interaction:new', interaction)
  }
}
