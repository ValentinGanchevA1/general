import 'reflect-metadata';
import { ConflictException, UnauthorizedException } from '@nestjs/common';
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

  beforeEach(async () => {
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
