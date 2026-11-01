import { Body, Controller, Get, HttpCode, Param, Post, Query, UseGuards } from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import {
  ArrayMaxSize,
  ArrayMinSize,
  ArrayUnique,
  IsArray,
  IsString,
  IsUUID,
  MaxLength,
  MinLength,
} from 'class-validator';

import type {
  ConversationSummary,
  CreateGroupConversationRequest,
  CreateGroupConversationResponse,
  GroupConversationSummary,
  LocationShareSession,
  MessagePage,
} from '@g88/shared';

import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { CurrentUser } from '../auth/current-user.decorator';
import { ChatService } from './chat.service';
import { GroupConversationsService } from './group-conversations.service';
import { LocationShareService } from './location-share.service';

export class CreateGroupConversationDto implements CreateGroupConversationRequest {
  @IsString()
  @MinLength(1)
  @MaxLength(80)
  title!: string;

  @IsArray()
  @ArrayMinSize(2)
  @ArrayMaxSize(19)
  @ArrayUnique()
  @IsUUID('4', { each: true })
  memberUserIds!: string[];
}

@Controller()
@UseGuards(JwtAuthGuard)
export class ChatController {
  constructor(
    private readonly chat: ChatService,
    private readonly groups: GroupConversationsService,
    private readonly locationShare: LocationShareService,
  ) {}

  @Get('conversations')
  async listConversations(@CurrentUser('id') userId: string): Promise<ConversationSummary[]> {
    return this.chat.findConversations(userId);
  }

  /** Metadata-only P4.G list. Member identities stay out of this first activation slice. */
  @Get('conversations/groups')
  async listGroupConversations(
    @CurrentUser('id') userId: string,
  ): Promise<GroupConversationSummary[]> {
    return this.groups.listForUser(userId);
  }

  /**
   * Create a normalized group conversation. Realtime fanout and precise live
   * location remain deliberately unactivated for groups in this slice.
   */
  @Post('conversations/groups')
  @Throttle({ default: { limit: 5, ttl: 60_000 } })
  async createGroupConversation(
    @Body() dto: CreateGroupConversationDto,
    @CurrentUser('id') userId: string,
  ): Promise<CreateGroupConversationResponse> {
    return this.groups.create(userId, dto.title, dto.memberUserIds);
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

  /** Explicit mark-read (also runs on first page of GET messages). */
  @Post('conversations/:id/read')
  @HttpCode(204)
  async markRead(
    @Param('id') conversationId: string,
    @CurrentUser('id') userId: string,
  ): Promise<void> {
    await this.chat.markConversationRead(conversationId, userId);
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