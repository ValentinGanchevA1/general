import { createHmac } from 'node:crypto';
import { Test } from '@nestjs/testing';
import { DataSource } from 'typeorm';
import { getDataSourceToken } from '@nestjs/typeorm';
import { BadRequestException, ServiceUnavailableException } from '@nestjs/common';

import { REDIS_CLIENT } from '../../config/redis.provider';
import { SocialService } from './social.service';
import { UsersService } from '../users/users.service';

const SECRET = 'a'.repeat(40);

function signedState(payload: object, secret = SECRET): string {
  const body = Buffer.from(JSON.stringify(payload)).toString('base64url');
  const sig = createHmac('sha256', secret).update(body).digest('base64url');
  return `${body}.${sig}`;
}

describe('SocialService', () => {
  let service: SocialService;
  let query: jest.Mock;
  let getProfile: jest.Mock;
  let redis: { set: jest.Mock; get: jest.Mock; del: jest.Mock; getdel: jest.Mock };

  beforeEach(async () => {
    process.env.JWT_SECRET = SECRET;
    // Ensure providers are unconfigured (no client creds in env).
    delete process.env.INSTAGRAM_CLIENT_ID;
    delete process.env.TWITTER_CLIENT_ID;
    query = jest.fn().mockResolvedValue([]);
    getProfile = jest.fn().mockResolvedValue({ id: 'u1' });
    redis = {
      set: jest.fn().mockResolvedValue('OK'),
      get: jest.fn().mockResolvedValue(null),
      del: jest.fn().mockResolvedValue(1),
      getdel: jest.fn().mockResolvedValue(null),
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

  it('refuses to start linking for an unconfigured provider', async () => {
    await expect(service.buildStartUrl('u1', 'instagram')).rejects.toThrow(ServiceUnavailableException);
  });

  describe('buildStartUrl — PKCE', () => {
    it('stores code_verifier in Redis and returns authorize URL with challenge', async () => {
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

      delete process.env.TWITTER_CLIENT_ID;
      delete process.env.TWITTER_CLIENT_SECRET;
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

    it('rejects when PKCE verifier is missing from Redis', async () => {
      process.env.INSTAGRAM_CLIENT_ID = 'ig-id';
      process.env.INSTAGRAM_CLIENT_SECRET = 'ig-secret';
      const state = signedState({
        uid: 'u1',
        p: 'instagram',
        exp: Date.now() + 1e6,
        n: 'missing-nonce',
      });
      redis.getdel.mockResolvedValue(null);
      redis.get.mockResolvedValue(null);

      await expect(service.handleCallback('code', state)).rejects.toMatchObject({
        response: expect.objectContaining({ code: 'social.pkce_missing' }),
      });

      delete process.env.INSTAGRAM_CLIENT_ID;
      delete process.env.INSTAGRAM_CLIENT_SECRET;
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
