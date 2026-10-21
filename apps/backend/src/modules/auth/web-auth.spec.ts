import { ForbiddenException, UnauthorizedException } from '@nestjs/common';
import type { Request, Response } from 'express';

import {
  assertTrustedWebAuthRequest,
  clearWebRefreshCookie,
  optionalWebRefreshToken,
  requireWebRefreshToken,
  setWebRefreshCookie,
} from './web-auth';

describe('web auth boundary', () => {
  const originalNodeEnv = process.env.NODE_ENV;
  const originalCorsOrigins = process.env.CORS_ORIGINS;

  afterEach(() => {
    if (originalNodeEnv === undefined) delete process.env.NODE_ENV;
    else process.env.NODE_ENV = originalNodeEnv;

    if (originalCorsOrigins === undefined) delete process.env.CORS_ORIGINS;
    else process.env.CORS_ORIGINS = originalCorsOrigins;
  });

  it('accepts the local preview origin only with the web session marker', () => {
    process.env.NODE_ENV = 'test';
    delete process.env.CORS_ORIGINS;

    expect(() => assertTrustedWebAuthRequest(request({
      origin: 'http://127.0.0.1:4174',
      'x-nexa-web-session': '1',
    }))).not.toThrow();

    expect(() => assertTrustedWebAuthRequest(request({
      origin: 'http://127.0.0.1:4174',
    }))).toThrow(ForbiddenException);
  });

  it('rejects an origin outside the allowlist', () => {
    process.env.NODE_ENV = 'production';
    process.env.CORS_ORIGINS = 'https://app.nexa.example';

    expect(() => assertTrustedWebAuthRequest(request({
      origin: 'https://evil.example',
      'x-nexa-web-session': '1',
    }))).toThrow(ForbiddenException);
  });

  it('reads only the dedicated refresh cookie', () => {
    const req = request({}, 'other=abc; nexa_web_refresh=refresh-123; theme=dark');

    expect(requireWebRefreshToken(req)).toBe('refresh-123');
    expect(optionalWebRefreshToken(req)).toBe('refresh-123');
  });

  it('rejects refresh when the browser cookie is missing', () => {
    expect(() => requireWebRefreshToken(request({}))).toThrow(UnauthorizedException);
  });

  it('sets and clears an HttpOnly SameSite refresh cookie scoped to web auth', () => {
    process.env.NODE_ENV = 'production';
    const cookie = jest.fn();
    const clearCookie = jest.fn();
    const response = { cookie, clearCookie } as unknown as Response;

    setWebRefreshCookie(response, 'refresh-123');
    clearWebRefreshCookie(response);

    expect(cookie).toHaveBeenCalledWith('nexa_web_refresh', 'refresh-123', {
      httpOnly: true,
      secure: true,
      sameSite: 'lax',
      path: '/api/v1/auth/web',
    });
    expect(clearCookie).toHaveBeenCalledWith('nexa_web_refresh', {
      httpOnly: true,
      secure: true,
      sameSite: 'lax',
      path: '/api/v1/auth/web',
    });
  });
});

function request(headers: Record<string, string>, cookie?: string): Request {
  const normalized = new Map(Object.entries(headers).map(([key, value]) => [key.toLowerCase(), value]));
  return {
    header: (name: string) => normalized.get(name.toLowerCase()),
    headers: cookie ? { cookie } : {},
  } as unknown as Request;
}
