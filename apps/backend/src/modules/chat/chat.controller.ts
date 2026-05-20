import { Controller, Get, Param, Query, UseGuards } from '@nestjs/common';

import type { ConversationSummary, MessagePage } from '@g88/shared';

import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { CurrentUser } from '../auth/current-user.decorator';
import { ChatService } from './chat.service';

@Controller()
@UseGuards(JwtAuthGuard)
export class ChatController {
  constructor(private readonly chat: ChatService) {}

  @Get('conversations')
  async listConversations(@CurrentUser('id') userId: string): Promise<ConversationSummary[]> {
    return this.chat.findConversations(userId);
  }

  @Get('conversations/:id/messages')
  async getMessages(
    @Param('id') conversationId: string,
    @CurrentUser('id') userId: string,
    @Query('cursor') cursor?: string,
    @Query('limit') limit?: string,
  ): Promise<MessagePage> {
    return this.chat.findMessages(conversationId, userId, cursor, limit ? Number(limit) : 50);
  }
}
