import { createHmac } from 'node:crypto';
import { Test } from '@nestjs/testing';
import { DataSource } from 'typeorm';
import { getDataSourceToken } from '@nestjs/typeorm';
import { BadRequestException, ServiceUnavailableException } from '@nestjs/common';

import { REDIS_CLIENT } from '../../config/redis.provider';
import { SocialService } from './social.service';
import { UsersService } from '../users/users.service';

const SECRET = 'a'.repeat(40);
const PROVIDER_CREDENTIAL_ENV = [
  'INSTAGRAM_CLIENT_ID',
  'INSTAGRAM_CLIENT_SECRET',
  'TWITTER_CLIENT_ID',
  'TWITTER_CLIENT_SECRET',
  'TIKTOK_CLIENT_ID',
  'TIKTOK_CLIENT_SECRET',
  'FACEBOOK_CLIENT_ID',
  'FACEBOOK_CLIENT_SECRET',
  'LINKEDIN_CLIENT_ID',
  'LINKEDIN_CLIENT_SECRET',
  'SPOTIFY_CLIENT_ID',
  'SPOTIFY_CLIENT_SECRET',
] as const;

function clearProviderCredentials(): void {
  for (const key of PROVIDER_CREDENTIAL_ENV) delete process.env[key];
}

function signedState(payload: object, secret = SECRET): string {
  const body = Buffer.from(JSON.stringify(payload)).toString('base64url');
  const sig = createHmac('sha256', secret).update(body).digest('base64url');
  return `${body}.${sig}`;
}

function jsonResponse(body: unknown, status = 200): Response {
  return {
    ok: status >= 200 && status < 300,
    status,
    json: jest.fn().mockResolvedValue(body),
    text: jest.fn().mockResolvedValue(JSON.stringify(body)),
  } as unknown as Response;
}

describe('SocialService', () => {
  let service: SocialService;
  let query: jest.Mock;
  let getProfile: jest.Mock;
  let redis: { set: jest.Mock; get: jest.Mock; del: jest.Mock };

  beforeEach(async () => {
    process.env.JWT_SECRET = SECRET;
    clearProviderCredentials();
    query = jest.fn().mockResolvedValue([]);
    getProfile = jest.fn().mockResolvedValue({ id: 'u1' });
    redis = {
      set: jest.fn().mockResolvedValue('OK'),
      get: jest.fn().mockResolvedValue(null),
      del: jest.fn().mockResolvedValue(1),
    };
    const mod = await Test.createTestingModule({
      providers: [
        SocialService,
        { provide: getDataSourceToken(), useValue: { query } as unknown as DataSource },
        { provide: UsersService, useValue: { getProfile } },
        { provide: REDIS_CLIENT, useValue: redis },
      ],
    }).compile();
    service = mod.get(SocialService);
  });

  afterEach(() => {
    jest.restoreAllMocks();
    clearProviderCredentials();
  });

  it('refuses to start linking for an unconfigured provider', async () => {
    await expect(service.buildStartUrl('u1', 'instagram')).rejects.toThrow(ServiceUnavailableException);
  });

  describe('provider availability', () => {
    it('reports only providers with both OAuth credentials as available', () => {
      process.env.TWITTER_CLIENT_ID = 'tw-id';
      process.env.TWITTER_CLIENT_SECRET = 'tw-secret';
      process.env.INSTAGRAM_CLIENT_ID = 'ig-id-without-secret';

      const result = service.getProviderAvailability();

      expect(result.providers).toContainEqual({ provider: 'twitter', available: true });
      expect(result.providers).toContainEqual({ provider: 'instagram', available: false });
      expect(result.providers).toHaveLength(6);
    });
  });

  describe('buildStartUrl — provider OAuth contract', () => {
    it('stores code_verifier in Redis and returns PKCE challenge for providers that support it', async () => {
      process.env.TWITTER_CLIENT_ID = 'tw-id';
      process.env.TWITTER_CLIENT_SECRET = 'tw-secret';

      const url = await service.buildStartUrl('u1', 'twitter');

      expect(redis.set).toHaveBeenCalled();
      const [key, verifier, mode, ttl] = redis.set.mock.calls[0]!;
      expect(key).toMatch(/^social:pkce:/);
      expect(typeof verifier).toBe('string');
      expect(verifier.length).toBeGreaterThanOrEqual(43);
      expect(mode).toBe('EX');
      expect(ttl).toBe(600);

      expect(url).toContain('https://x.com/i/oauth2/authorize');
      expect(url).toContain('code_challenge=');
      expect(url).toContain('code_challenge_method=S256');
      expect(url).toContain('client_id=tw-id');
      expect(url).toContain('scope=');
    });

    it('uses Instagram Business Login without PKCE authorization params', async () => {
      process.env.INSTAGRAM_CLIENT_ID = 'ig-id';
      process.env.INSTAGRAM_CLIENT_SECRET = 'ig-secret';

      const url = new URL(await service.buildStartUrl('u1', 'instagram'));

      expect(`${url.origin}${url.pathname}`).toBe('https://www.instagram.com/oauth/authorize');
      expect(url.searchParams.get('client_id')).toBe('ig-id');
      expect(url.searchParams.get('scope')).toBe('instagram_business_basic');
      expect(url.searchParams.get('response_type')).toBe('code');
      expect(url.searchParams.get('code_challenge')).toBeNull();
      expect(url.searchParams.get('code_challenge_method')).toBeNull();
      expect(redis.set).toHaveBeenCalledTimes(1);
    });
  });

  describe('handleCallback — signed-state (CSRF) gate', () => {
    it('rejects a tampered signature before any token exchange', async () => {
      const body = Buffer.from(
        JSON.stringify({ uid: 'u1', p: 'instagram', exp: Date.now() + 1e6, n: 'nonce' }),
      ).toString('base64url');
      const tampered = `${body}.not-the-real-signature`;
      await expect(service.handleCallback('code', tampered)).rejects.toMatchObject({
        response: expect.objectContaining({ code: 'social.bad_state' }),
      });
    });

    it('rejects a state signed with the wrong secret', async () => {
      const state = signedState(
        { uid: 'u1', p: 'instagram', exp: Date.now() + 1e6, n: 'nonce' },
        'wrong-secret',
      );
      await expect(service.handleCallback('code', state)).rejects.toBeInstanceOf(BadRequestException);
    });

    it('rejects an expired (but validly signed) state', async () => {
      const state = signedState({ uid: 'u1', p: 'instagram', exp: Date.now() - 1, n: 'nonce' });
      await expect(service.handleCallback('code', state)).rejects.toMatchObject({
        response: expect.objectContaining({ code: 'social.state_expired' }),
      });
    });

    it('rejects when the one-time flow secret is missing from Redis', async () => {
      process.env.INSTAGRAM_CLIENT_ID = 'ig-id';
      process.env.INSTAGRAM_CLIENT_SECRET = 'ig-secret';
      const state = signedState({
        uid: 'u1',
        p: 'instagram',
        exp: Date.now() + 1e6,
        n: 'missing-nonce',
      });
      redis.get.mockResolvedValue(null);

      await expect(service.handleCallback('code', state)).rejects.toMatchObject({
        response: expect.objectContaining({ code: 'social.pkce_missing' }),
      });
    });
  });

  describe('Instagram Business Login callback', () => {
    it('omits code_verifier and binds the Instagram-scoped user_id', async () => {
      process.env.INSTAGRAM_CLIENT_ID = 'ig-id';
      process.env.INSTAGRAM_CLIENT_SECRET = 'ig-secret';
      redis.get.mockResolvedValue('one-time-flow-secret');
      const fetchMock = jest
        .spyOn(globalThis, 'fetch')
        .mockResolvedValueOnce(jsonResponse({ access_token: 'provider-token' }))
        .mockResolvedValueOnce(jsonResponse({ user_id: 'ig-user-42', username: 'alice' }));
      const state = signedState({
        uid: 'u1',
        p: 'instagram',
        exp: Date.now() + 1e6,
        n: 'ig-nonce',
      });

      await expect(service.handleCallback('code', state)).resolves.toBe('instagram');

      const tokenInit = fetchMock.mock.calls[0]![1];
      const tokenBody = new URLSearchParams(String(tokenInit?.body ?? ''));
      expect(tokenBody.get('grant_type')).toBe('authorization_code');
      expect(tokenBody.get('client_id')).toBe('ig-id');
      expect(tokenBody.get('client_secret')).toBe('ig-secret');
      expect(tokenBody.get('code')).toBe('code');
      expect(tokenBody.get('code_verifier')).toBeNull();

      expect(String(fetchMock.mock.calls[1]![0])).toContain(
        'https://graph.instagram.com/me?fields=user_id,username&access_token=provider-token',
      );
      expect(query.mock.calls[0]![1]).toEqual(['instagram', 'ig-user-42', 'u1']);
      expect(query.mock.calls[1]![1]).toEqual([
        'u1',
        'instagram',
        'ig-user-42',
        'alice',
        'https://instagram.com/alice',
      ]);
    });
  });

  describe('handleCallback — provider identity binding', () => {
    beforeEach(() => {
      process.env.TWITTER_CLIENT_ID = 'tw-id';
      process.env.TWITTER_CLIENT_SECRET = 'tw-secret';
      redis.get.mockResolvedValue('pkce-verifier');
      jest
        .spyOn(globalThis, 'fetch')
        .mockResolvedValueOnce(jsonResponse({ access_token: 'provider-token' }))
        .mockResolvedValueOnce(
          jsonResponse({ data: { id: 'provider-user-42', username: 'alice' } }),
        );
    });

    it('stores the stable provider user id on a successful link', async () => {
      query.mockResolvedValueOnce([]).mockResolvedValueOnce([]);
      const state = signedState({
        uid: 'u1',
        p: 'twitter',
        exp: Date.now() + 1e6,
        n: 'nonce-success',
      });

      await expect(service.handleCallback('code', state)).resolves.toBe('twitter');

      expect(query.mock.calls[0]![0]).toContain('provider_user_id = $2');
      expect(query.mock.calls[0]![1]).toEqual(['twitter', 'provider-user-42', 'u1']);
      expect(query.mock.calls[1]![0]).toContain('provider_user_id');
      expect(query.mock.calls[1]![1]).toEqual([
        'u1',
        'twitter',
        'provider-user-42',
        'alice',
        'https://x.com/alice',
      ]);
    });

    it('rejects a provider account already linked to another NEXA user', async () => {
      query.mockResolvedValueOnce([{ user_id: 'u2' }]);
      const state = signedState({
        uid: 'u1',
        p: 'twitter',
        exp: Date.now() + 1e6,
        n: 'nonce-conflict',
      });

      await expect(service.handleCallback('code', state)).rejects.toMatchObject({
        response: expect.objectContaining({ code: 'social.account_already_linked' }),
      });
      expect(query).toHaveBeenCalledTimes(1);
    });
  });

  describe('unlink', () => {
    it('deletes the link and returns the refreshed profile', async () => {
      const res = await service.unlink('u1', 'instagram');
      expect(query.mock.calls[0]![0]).toContain('DELETE FROM social_links');
      expect(query.mock.calls[0]![1]).toEqual(['u1', 'instagram']);
      expect(getProfile).toHaveBeenCalledWith('u1');
      expect(res).toEqual({ id: 'u1' });
    });
  });
});
