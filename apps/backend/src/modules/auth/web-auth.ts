import { ForbiddenException, UnauthorizedException } from '@nestjs/common';
import type { AuthenticatedUser, AuthTokens } from '@g88/shared';
import type { Request, Response } from 'express';

import { isCorsOriginAllowed } from '../../common/cors-origins';

const WEB_REFRESH_COOKIE = 'nexa_web_refresh';
const WEB_REFRESH_COOKIE_PATH = '/api/v1/auth/web';
const WEB_SESSION_HEADER = 'x-nexa-web-session';

export interface WebAccessTokenResponse {
  accessToken: string;
  expiresAt: string;
}

export interface WebLoginResponse extends WebAccessTokenResponse {
  user: AuthenticatedUser;
}

export function assertTrustedWebAuthRequest(request: Request): void {
  const marker = request.header(WEB_SESSION_HEADER);
  const origin = request.header('origin');

  if (marker !== '1' || !isCorsOriginAllowed(origin)) {
    throw new ForbiddenException({
      code: 'auth.web_origin_forbidden',
      message: 'Browser auth request origin is not allowed',
    });
  }
}

export function requireWebRefreshToken(request: Request): string {
  const token = readCookie(request, WEB_REFRESH_COOKIE);
  if (!token) {
    throw new UnauthorizedException({
      code: 'auth.web_session_missing',
      message: 'Browser session is missing',
    });
  }
  return token;
}

export function optionalWebRefreshToken(request: Request): string | null {
  return readCookie(request, WEB_REFRESH_COOKIE);
}

export function setWebRefreshCookie(response: Response, refreshToken: string): void {
  response.cookie(WEB_REFRESH_COOKIE, refreshToken, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    path: WEB_REFRESH_COOKIE_PATH,
  });
}

export function clearWebRefreshCookie(response: Response): void {
  response.clearCookie(WEB_REFRESH_COOKIE, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    path: WEB_REFRESH_COOKIE_PATH,
  });
}

export function toWebAccessToken(tokens: AuthTokens): WebAccessTokenResponse {
  return {
    accessToken: tokens.accessToken,
    expiresAt: tokens.expiresAt,
  };
}

function readCookie(request: Request, name: string): string | null {
  const header = request.headers.cookie;
  if (!header) return null;

  for (const entry of header.split(';')) {
    const separator = entry.indexOf('=');
    if (separator < 0) continue;

    const key = entry.slice(0, separator).trim();
    if (key !== name) continue;

    const value = entry.slice(separator + 1).trim();
    return value || null;
  }

  return null;
}
