import { Body, Controller, Post, UseGuards } from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import { IsUUID } from 'class-validator';

import type { CreateConversationRequest, CreateConversationResponse } from '@g88/shared';

import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { CurrentUser } from '../auth/current-user.decorator';
import { MessagingService } from './messaging.service';

export class CreateConversationDto implements CreateConversationRequest {
  @IsUUID()
  targetUserId!: string;
}

@Controller('conversations')
@UseGuards(JwtAuthGuard)
export class MessagingController {
  constructor(private readonly messaging: MessagingService) {}

  /**
   * Open or fetch a 1:1 conversation toward another user. The gate is enforced
   * here, not on the client: a match returns the accepted chat; a shared
   * interest mints a pending request; otherwise 403 `chat.locked`.
   */
  @Post()
  @Throttle({ default: { limit: 10, ttl: 60_000 } }) // 10 new requests/min
  async create(
    @Body() dto: CreateConversationDto,
    @CurrentUser('id') userId: string,
  ): Promise<CreateConversationResponse> {
    return this.messaging.openForMessaging(userId, dto.targetUserId);
  }
}
