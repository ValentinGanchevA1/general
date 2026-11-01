import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  Param,
  ParseUUIDPipe,
  Post,
  UseGuards,
} from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import {
  ArrayMaxSize,
  ArrayMinSize,
  ArrayUnique,
  IsArray,
  IsString,
  IsUUID,
  Length,
} from 'class-validator';

import type {
  CreateGroupConversationRequest,
  CreateGroupConversationResponse,
  GroupConversationSummary,
} from '@g88/shared';

import { CurrentUser } from '../auth/current-user.decorator';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { GroupConversationsService } from './group-conversations.service';

class CreateGroupConversationDto implements CreateGroupConversationRequest {
  @IsUUID()
  clientRequestId!: string;

  @IsString()
  @Length(1, 80)
  title!: string;

  @IsArray()
  @ArrayMinSize(2)
  @ArrayMaxSize(31)
  @ArrayUnique()
  @IsUUID(undefined, { each: true })
  memberIds!: string[];
}

@Controller('conversations/groups')
@UseGuards(JwtAuthGuard)
export class GroupConversationsController {
  constructor(private readonly groups: GroupConversationsService) {}

  @Get()
  async list(@CurrentUser('id') userId: string): Promise<GroupConversationSummary[]> {
    return this.groups.list(userId);
  }

  @Post()
  @Throttle({ default: { limit: 5, ttl: 60_000 } })
  async create(
    @Body() dto: CreateGroupConversationDto,
    @CurrentUser('id') userId: string,
  ): Promise<CreateGroupConversationResponse> {
    return this.groups.create(userId, dto);
  }

  /**
   * Self-targeting means leave. Owners may remove admins/members; admins may
   * remove members. Membership history is soft-left rather than deleted.
   */
  @Delete(':conversationId/members/:memberId')
  @HttpCode(204)
  async removeMember(
    @Param('conversationId', new ParseUUIDPipe()) conversationId: string,
    @Param('memberId', new ParseUUIDPipe()) memberId: string,
    @CurrentUser('id') userId: string,
  ): Promise<void> {
    await this.groups.removeMember(userId, conversationId, memberId);
  }
}
