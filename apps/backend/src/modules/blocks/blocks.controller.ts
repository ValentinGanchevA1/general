import { Controller, Delete, Get, Param, ParseUUIDPipe, Post, UseGuards } from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';

import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { CurrentUser } from '../auth/current-user.decorator';
import { BlocksService } from './blocks.service';

@Controller('blocks')
@UseGuards(JwtAuthGuard)
export class BlocksController {
  constructor(private readonly blocks: BlocksService) {}

  /** The caller's own block list (for a "Blocked users" settings screen). */
  @Get()
  list(@CurrentUser('id') userId: string) {
    return this.blocks.listBlockedBy(userId);
  }

  @Post(':userId')
  @Throttle({ default: { limit: 20, ttl: 60_000 } })
  async block(@CurrentUser('id') userId: string, @Param('userId', ParseUUIDPipe) targetId: string) {
    await this.blocks.block(userId, targetId);
    return { blocked: true };
  }

  @Delete(':userId')
  @Throttle({ default: { limit: 20, ttl: 60_000 } })
  async unblock(@CurrentUser('id') userId: string, @Param('userId', ParseUUIDPipe) targetId: string) {
    await this.blocks.unblock(userId, targetId);
    return { blocked: false };
  }
}
