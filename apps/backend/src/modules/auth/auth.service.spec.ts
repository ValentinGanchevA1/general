import 'reflect-metadata';
import { BadRequestException, ConflictException, ForbiddenException, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { Test } from '@nestjs/testing';
import { getDataSourceToken } from '@nestjs/typeorm';
import { QueryFailedError } from 'typeorm';

import { AuthService } from './auth.service';

const mockJwt = {
  sign: jest.fn(() => 'access-token'),
  decode: jest.fn(() => ({ exp: 9_999_999_999 })),
};

describe('AuthService', () => {
  let service: AuthService;
  let db: { query: jest.Mock };

  const priorAdultPolicy = process.env.NEXUS_REQUIRE_ADULT_AGE;

  afterEach(() => {
    if (priorAdultPolicy === undefined) delete process.env.NEXUS_REQUIRE_ADULT_AGE;
    else process.env.NEXUS_REQUIRE_ADULT_AGE = priorAdultPolicy;
  });

  beforeEach(async () => {
    delete process.env.NEXUS_REQUIRE_ADULT_AGE;
    db = { query: jest.fn() };
    const module = await Test.createTestingModule({
      providers: [
        AuthService,
        { provide: getDataSourceToken(), useValue: db },
        { provide: JwtService, useValue: mockJwt },
      ],
    }).compile();
    service = module.get(AuthService);
  });

  describe('me()', () => {
    it('throws UnauthorizedException when user not found', async () => {
      db.query.mockResolvedValueOnce([]);
      await expect(service.me('no-such-id')).rejects.toBeInstanceOf(UnauthorizedException);
    });
  });

  describe('login()', () => {
    it('throws UnauthorizedException when email does not exist', async () => {
      db.query.mockResolvedValueOnce([]);
      await expect(service.login('ghost@x.com', 'pw')).rejects.toBeInstanceOf(UnauthorizedException);
    });

    it('throws UnauthorizedException when password is wrong', async () => {
      // Return a user row with a bcrypt hash that won't match 'wrong-pw'
      db.query.mockResolvedValueOnce([{
        id: 'u1',
        email: 'a@b.com',
        // bcrypt hash of 'correct-pw' — 'wrong-pw' will not match
        password_hash: '$2a$12$invalidhashpaddinginvalidhashpaddinginvalidhashXXXXXXX',
        display_name: 'Alice',
        avatar_url: null,
        verification_level: 'none',
      }]);
      await expect(service.login('a@b.com', 'wrong-pw')).rejects.toBeInstanceOf(UnauthorizedException);
    });
  });

  describe('register()', () => {
    it('fails closed on missing or underage DOB when 18+ Social gate is enabled', async () => {
      process.env.NEXUS_REQUIRE_ADULT_AGE = 'true';
      await expect(service.register('person@example.com', 'password-123', 'User')).rejects.toBeInstanceOf(ForbiddenException);
      await expect(service.register('minor@example.com', 'password-123', 'User', '2010-01-01')).rejects.toBeInstanceOf(ForbiddenException);
      expect(db.query).not.toHaveBeenCalled();
    });

    it('rejects impossible DOB even with adult gate disabled', async () => {
      await expect(service.register('person@example.com', 'password-123', 'User', '2000-02-30')).rejects.toBeInstanceOf(BadRequestException);
      expect(db.query).not.toHaveBeenCalled();
    });

    it('persists valid adult DOB before issuing tokens with gate enabled', async () => {
      process.env.NEXUS_REQUIRE_ADULT_AGE = 'true';
      db.query.mockResolvedValueOnce([{ id: 'u-adult', email: 'adult@example.com', auth_version: 0, display_name: 'Adult', avatar_url: null, verification_level: 'none' }]).mockResolvedValueOnce([{ id: 'refresh-row' }]);
      const response = await service.register('adult@example.com', 'password-123', 'Adult', '2000-01-01');
      expect(response.tokens.accessToken).toBe('access-token');
      expect(db.query.mock.calls[0]?.[0]).toContain('date_of_birth');
      expect(db.query.mock.calls[0]?.[1]?.[3]).toBe('2000-01-01');
    });

    it('throws ConflictException when email unique constraint fails (23505)', async () => {
      // register() is INSERT-only; concurrent/taken email surfaces as Postgres unique_violation.
      const err = Object.assign(
        new QueryFailedError('INSERT', [], new Error('duplicate key value violates unique constraint')),
        { code: '23505' },
      );
      db.query.mockRejectedValueOnce(err);
      await expect(service.register('taken@x.com', 'pw', 'Name')).rejects.toBeInstanceOf(
        ConflictException,
      );
    });
  });
});

describe('AuthService refresh version boundary', () => {
  it('rejects an in-flight refresh from the version before password reset', async () => {
    const db = { query: jest.fn().mockResolvedValueOnce([{ user_id: 'u1', family: 'f1', auth_version: 0 }]).mockResolvedValueOnce([{ id: 'u1', email: 'person@example.com', auth_version: 1 }]) };
    const service = new AuthService(db as unknown as import('typeorm').DataSource, mockJwt as unknown as JwtService);
    await expect(service.refresh('old-refresh')).rejects.toBeInstanceOf(UnauthorizedException);
    expect(db.query).toHaveBeenCalledTimes(2);
  });
});
