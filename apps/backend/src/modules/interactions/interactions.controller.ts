import { Body, Controller, Get, Post, Query, UseGuards } from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import { IsIn, IsOptional, IsString, IsUUID } from 'class-validator';
import type {
  InboxResponse,
  ReceivedInteractionsResponse,
  WaveRequest,
  WaveResponse,
} from '@g88/shared';

import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { CurrentUser } from '../auth/current-user.decorator';
import { InteractionsInboxService } from './interactions-inbox.service';
import { InteractionsService } from './interactions.service';

export class WaveDto implements WaveRequest {
  @IsUUID()
  toUserId!: string;

  @IsOptional()
  @IsString()
  @IsIn(['map', 'profile', 'event'])
  context?: 'map' | 'profile' | 'event';
}

@Controller('interactions')
@UseGuards(JwtAuthGuard)
export class InteractionsController {
  constructor(
    private readonly interactions: InteractionsService,
    private readonly inboxProjection: InteractionsInboxService,
  ) {}

  @Post('wave')
  @Throttle({ default: { limit: 20, ttl: 60_000 } }) // 20 waves/min
  async wave(
    @Body() dto: WaveDto,
    @CurrentUser('id') userId: string,
  ): Promise<WaveResponse> {
    return this.interactions.wave(userId, dto);
  }

  /**
   * Unified inbound signals: waves + story reactions toward the caller.
   * Powers the "People who interacted with you" surface.
   */
  @Get('received')
  @Throttle({ default: { limit: 30, ttl: 60_000 } })
  async received(
    @CurrentUser('id') userId: string,
    @Query('limit') limitRaw?: string,
  ): Promise<ReceivedInteractionsResponse> {
    const limit = Math.min(Math.max(Number(limitRaw) || 50, 1), 100);
    const items = await this.interactions.listReceived(userId, limit);
    return { items };
  }

  /**
   * Personal Activity inbox: waves + story reactions + pending friend requests
   * + recent followers + gifts. Reading this projection has no mark-seen side effect.
   */
  @Get('inbox')
  @Throttle({ default: { limit: 30, ttl: 60_000 } })
  async inbox(
    @CurrentUser('id') userId: string,
    @Query('limit') limitRaw?: string,
  ): Promise<InboxResponse> {
    const limit = Math.min(Math.max(Number(limitRaw) || 50, 1), 100);
    const items = await this.inboxProjection.list(userId, limit);
    return { items };
  }
}
