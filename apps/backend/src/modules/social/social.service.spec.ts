import { createHmac } from 'node:crypto';
import { Test } from '@nestjs/testing';
import { DataSource } from 'typeorm';
import { getDataSourceToken } from '@nestjs/typeorm';
import { BadRequestException, ServiceUnavailableException } from '@nestjs/common';

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

  beforeEach(async () => {
    process.env.JWT_SECRET = SECRET;
    // Ensure providers are unconfigured (no client creds in env).
    delete process.env.INSTAGRAM_CLIENT_ID;
    query = jest.fn().mockResolvedValue([]);
    getProfile = jest.fn().mockResolvedValue({ id: 'u1' });
    const mod = await Test.createTestingModule({
      providers: [
        SocialService,
        { provide: getDataSourceToken(), useValue: { query } as unknown as DataSource },
        { provide: UsersService, useValue: { getProfile } },
      ],
    }).compile();
    service = mod.get(SocialService);
  });

  it('refuses to start linking for an unconfigured provider', () => {
    expect(() => service.buildStartUrl('u1', 'instagram')).toThrow(ServiceUnavailableException);
  });

  describe('handleCallback — signed-state (CSRF) gate', () => {
    it('rejects a tampered signature before any token exchange', async () => {
      const body = Buffer.from(JSON.stringify({ uid: 'u1', p: 'instagram', exp: Date.now() + 1e6 })).toString('base64url');
      const tampered = `${body}.not-the-real-signature`;
      await expect(service.handleCallback('code', tampered)).rejects.toMatchObject({
        response: expect.objectContaining({ code: 'social.bad_state' }),
      });
    });

    it('rejects a state signed with the wrong secret', async () => {
      const state = signedState({ uid: 'u1', p: 'instagram', exp: Date.now() + 1e6 }, 'wrong-secret');
      await expect(service.handleCallback('code', state)).rejects.toBeInstanceOf(BadRequestException);
    });

    it('rejects an expired (but validly signed) state', async () => {
      const state = signedState({ uid: 'u1', p: 'instagram', exp: Date.now() - 1 });
      await expect(service.handleCallback('code', state)).rejects.toMatchObject({
        response: expect.objectContaining({ code: 'social.state_expired' }),
      });
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
