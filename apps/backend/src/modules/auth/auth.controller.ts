import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Post,
  Req,
  Res,
  UseGuards,
} from '@nestjs/common';
import { SkipThrottle, Throttle } from '@nestjs/throttler';
import type { Request, Response } from 'express';

import type { LoginResponse, AuthTokens, AuthenticatedUser } from '@g88/shared';

import { AuthService } from './auth.service';
import { JwtAuthGuard } from './jwt-auth.guard';
import { CurrentUser } from './current-user.decorator';
import { GoogleOAuthDto, LoginDto, LogoutDto, RefreshDto, RegisterDto } from './dto';
import {
  assertTrustedWebAuthRequest,
  clearWebRefreshCookie,
  optionalWebRefreshToken,
  requireWebRefreshToken,
  setWebRefreshCookie,
  toWebAccessToken,
  type WebAccessTokenResponse,
  type WebLoginResponse,
} from './web-auth';

@Controller('auth')
export class AuthController {
  constructor(private readonly auth: AuthService) {}

  @Post('register')
  @Throttle({ default: { limit: 5, ttl: 60_000 } })
  async register(@Body() dto: RegisterDto): Promise<LoginResponse> {
    return this.auth.register(dto.email, dto.password, dto.displayName);
  }

  @Post('login')
  @HttpCode(HttpStatus.OK)
  @Throttle({ default: { limit: 10, ttl: 60_000 } })
  async login(@Body() dto: LoginDto): Promise<LoginResponse> {
    return this.auth.login(dto.email, dto.password);
  }

  @Post('refresh')
  @HttpCode(HttpStatus.OK)
  @Throttle({ default: { limit: 30, ttl: 60_000 } })
  async refresh(@Body() dto: RefreshDto): Promise<AuthTokens> {
    return this.auth.refresh(dto.refreshToken);
  }

  @Post('logout')
  @HttpCode(HttpStatus.NO_CONTENT)
  @SkipThrottle()
  async logout(@Body() dto: LogoutDto): Promise<void> {
    return this.auth.logout(dto.refreshToken);
  }

  @Post('web/login')
  @HttpCode(HttpStatus.OK)
  @Throttle({ default: { limit: 10, ttl: 60_000 } })
  async webLogin(
    @Req() request: Request,
    @Res({ passthrough: true }) response: Response,
    @Body() dto: LoginDto,
  ): Promise<WebLoginResponse> {
    assertTrustedWebAuthRequest(request);
    const result = await this.auth.login(dto.email, dto.password);
    setWebRefreshCookie(response, result.tokens.refreshToken);
    return {
      user: result.user,
      ...toWebAccessToken(result.tokens),
    };
  }

  @Post('web/refresh')
  @HttpCode(HttpStatus.OK)
  @Throttle({ default: { limit: 30, ttl: 60_000 } })
  async webRefresh(
    @Req() request: Request,
    @Res({ passthrough: true }) response: Response,
  ): Promise<WebAccessTokenResponse> {
    assertTrustedWebAuthRequest(request);
    const refreshToken = requireWebRefreshToken(request);

    try {
      const tokens = await this.auth.refresh(refreshToken);
      setWebRefreshCookie(response, tokens.refreshToken);
      return toWebAccessToken(tokens);
    } catch (error: unknown) {
      clearWebRefreshCookie(response);
      throw error;
    }
  }

  @Post('web/logout')
  @HttpCode(HttpStatus.NO_CONTENT)
  @SkipThrottle()
  async webLogout(
    @Req() request: Request,
    @Res({ passthrough: true }) response: Response,
  ): Promise<void> {
    assertTrustedWebAuthRequest(request);
    const refreshToken = optionalWebRefreshToken(request);
    if (refreshToken) await this.auth.logout(refreshToken);
    clearWebRefreshCookie(response);
  }

  @Post('oauth/google')
  @HttpCode(HttpStatus.OK)
  @Throttle({ default: { limit: 10, ttl: 60_000 } })
  async googleOAuth(@Body() dto: GoogleOAuthDto): Promise<LoginResponse> {
    return this.auth.googleOAuth(dto.idToken);
  }

  @Get('me')
  @UseGuards(JwtAuthGuard)
  @SkipThrottle()
  async me(@CurrentUser('id') userId: string): Promise<AuthenticatedUser> {
    return this.auth.me(userId);
  }
}
