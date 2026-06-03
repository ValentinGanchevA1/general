import { Body, Controller, Get, Post, UseGuards } from '@nestjs/common';
import { SkipThrottle, Throttle } from '@nestjs/throttler';

import type {
  GiftBalance,
  GiftCatalogItem,
  GiftSentResult,
  ReceivedGift,
} from '@g88/shared';

import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { CurrentUser } from '../auth/current-user.decorator';
import { GiftsService } from './gifts.service';
import { SendGiftDto } from './dto';

@Controller('gifts')
@UseGuards(JwtAuthGuard)
export class GiftsController {
  constructor(private readonly gifts: GiftsService) {}

  /** Active gift catalog (static-ish — safe to skip the throttler). */
  @Get('catalog')
  @SkipThrottle()
  catalog(): Promise<GiftCatalogItem[]> {
    return this.gifts.catalog();
  }

  /** Caller's spendable wallet balance. */
  @Get('balance')
  @SkipThrottle()
  balance(@CurrentUser('id') userId: string): Promise<GiftBalance> {
    return this.gifts.balance(userId);
  }

  /** Caller's gift inbox; marks unseen as seen. */
  @Get('received')
  @SkipThrottle()
  received(@CurrentUser('id') userId: string): Promise<ReceivedGift[]> {
    return this.gifts.received(userId);
  }

  /** Spend XP to send a gift. Tight throttle — it mutates the wallet. */
  @Post('send')
  @Throttle({ default: { limit: 10, ttl: 60_000 } })
  send(
    @CurrentUser('id') userId: string,
    @Body() dto: SendGiftDto,
  ): Promise<GiftSentResult> {
    return this.gifts.send(userId, dto);
  }
}
