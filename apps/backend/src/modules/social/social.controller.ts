import {
  BadRequestException,
  Controller,
  Delete,
  Get,
  Param,
  Query,
  Res,
  UseGuards,
} from '@nestjs/common';
import type { Response } from 'express';
import { SkipThrottle, Throttle } from '@nestjs/throttler';

import type { SocialAuthorizeResponse, SocialProvider, UserProfile } from '@g88/shared';

import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { CurrentUser } from '../auth/current-user.decorator';
import { SocialService } from './social.service';
import { PROVIDERS } from './providers';

function assertProvider(p: string): SocialProvider {
  if (!(p in PROVIDERS)) {
    throw new BadRequestException({ code: 'social.unknown_provider', message: `Unknown provider: ${p}` });
  }
  return p as SocialProvider;
}

@Controller('social')
export class SocialController {
  constructor(private readonly social: SocialService) {}

  /** GET /api/v1/social/:provider/start — authorize URL to open in the browser. */
  @Get(':provider/start')
  @UseGuards(JwtAuthGuard)
  @Throttle({ default: { ttl: 60_000, limit: 20 } })
  start(
    @CurrentUser('id') userId: string,
    @Param('provider') provider: string,
  ): SocialAuthorizeResponse {
    return { url: this.social.buildStartUrl(userId, assertProvider(provider)) };
  }

  /**
   * GET /api/v1/social/callback — OAuth redirect target (no JWT; CSRF-protected
   * by the signed state). Bounces back to the app via a deep link / web page.
   */
  @Get('callback')
  @SkipThrottle()
  async callback(
    @Query('code') code: string | undefined,
    @Query('state') state: string | undefined,
    @Query('error') error: string | undefined,
    @Res() res: Response,
  ): Promise<void> {
    if (error || !code || !state) {
      res.redirect(this.social.returnUrl(null, 'error'));
      return;
    }
    try {
      const provider = await this.social.handleCallback(code, state);
      res.redirect(this.social.returnUrl(provider, 'ok'));
    } catch {
      res.redirect(this.social.returnUrl(null, 'error'));
    }
  }

  /** DELETE /api/v1/social/:provider — unlink; returns the updated profile. */
  @Delete(':provider')
  @UseGuards(JwtAuthGuard)
  unlink(
    @CurrentUser('id') userId: string,
    @Param('provider') provider: string,
  ): Promise<UserProfile> {
    return this.social.unlink(userId, assertProvider(provider));
  }
}
