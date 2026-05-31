import {
  BadRequestException,
  Body,
  Controller,
  Headers,
  HttpCode,
  HttpStatus,
  Post,
  Req,
  UseGuards,
} from '@nestjs/common';
import type { RawBodyRequest } from '@nestjs/common';
import type { Request } from 'express';
import { SkipThrottle, Throttle } from '@nestjs/throttler';

import type { CheckoutSessionResponse, PortalSessionResponse } from '@g88/shared';

import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { CurrentUser } from '../auth/current-user.decorator';
import { SubscriptionsService } from './subscriptions.service';
import { CreateCheckoutDto } from './dto';

@Controller('subscriptions')
export class SubscriptionsController {
  constructor(private readonly subscriptions: SubscriptionsService) {}

  /** POST /api/v1/subscriptions/checkout — hosted Checkout URL for a paid tier. */
  @Post('checkout')
  @UseGuards(JwtAuthGuard)
  @HttpCode(HttpStatus.OK)
  @Throttle({ default: { ttl: 60_000, limit: 10 } })
  async checkout(
    @CurrentUser('id') userId: string,
    @Body() dto: CreateCheckoutDto,
  ): Promise<CheckoutSessionResponse> {
    return { url: await this.subscriptions.createCheckout(userId, dto.tier) };
  }

  /** POST /api/v1/subscriptions/portal — billing portal URL to manage/cancel. */
  @Post('portal')
  @UseGuards(JwtAuthGuard)
  @HttpCode(HttpStatus.OK)
  @Throttle({ default: { ttl: 60_000, limit: 10 } })
  async portal(@CurrentUser('id') userId: string): Promise<PortalSessionResponse> {
    return { url: await this.subscriptions.createPortal(userId) };
  }

  /**
   * POST /api/v1/subscriptions/webhook — Stripe events (no JWT; signature-verified).
   * Requires the raw request body (enabled via rawBody:true in main.ts).
   */
  @Post('webhook')
  @SkipThrottle()
  @HttpCode(HttpStatus.OK)
  async webhook(
    @Req() req: RawBodyRequest<Request>,
    @Headers('stripe-signature') signature: string | undefined,
  ): Promise<{ received: true }> {
    if (!signature || !req.rawBody) {
      throw new BadRequestException({ code: 'subscription.bad_signature', message: 'Missing signature' });
    }
    await this.subscriptions.handleWebhook(req.rawBody, signature);
    return { received: true };
  }
}
