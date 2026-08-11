import { Controller, Get, Param, Query, UseGuards } from '@nestjs/common';

import type { ConversationSummary, LocationShareSession, MessagePage } from '@g88/shared';

import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { CurrentUser } from '../auth/current-user.decorator';
import { ChatService } from './chat.service';
import { LocationShareService } from './location-share.service';

@Controller()
@UseGuards(JwtAuthGuard)
export class ChatController {
  constructor(
    private readonly chat: ChatService,
    private readonly locationShare: LocationShareService,
  ) {}

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

  /** Active live-location session for cold-open of ChatScreen. */
  @Get('conversations/:id/location-session')
  async getActiveLocationSession(
    @Param('id') conversationId: string,
    @CurrentUser('id') userId: string,
  ): Promise<LocationShareSession | null> {
    return this.locationShare.findActiveForConversation(conversationId, userId);
  }
}
