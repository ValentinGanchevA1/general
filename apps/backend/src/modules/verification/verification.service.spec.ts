import { Test } from '@nestjs/testing';
import { DataSource, QueryFailedError } from 'typeorm';
import { getDataSourceToken } from '@nestjs/typeorm';
import {
  BadRequestException,
  ConflictException,
  NotFoundException,
  ServiceUnavailableException,
} from '@nestjs/common';

import { VerificationService } from './verification.service';
import { UsersService } from '../users/users.service';
import { REDIS_CLIENT } from '../../config/redis.provider';

const ORIGINAL_ENV = process.env;

describe('VerificationService', () => {
  let service: VerificationService;
  let query: jest.Mock;
  let getProfile: jest.Mock;
  let redis: { get: jest.Mock; setex: jest.Mock; del: jest.Mock };

  beforeEach(async () => {
    // Dev mode: no Twilio creds, not production -> fixed dev code path.
    process.env = { ...ORIGINAL_ENV, NODE_ENV: 'test' };
    delete process.env.TWILIO_ACCOUNT_SID;
    delete process.env.TWILIO_AUTH_TOKEN;
    delete process.env.TWILIO_VERIFY_SERVICE_SID;
    delete process.env.DEV_OTP_CODE;
    delete process.env.ALLOW_DEV_EMAIL_OTP;

    query = jest.fn().mockResolvedValue([]);
    getProfile = jest.fn().mockResolvedValue({ id: 'u1', verificationLevel: 'phone' });
    redis = {
      get: jest.fn().mockResolvedValue(null),
      setex: jest.fn().mockResolvedValue('OK'),
      del: jest.fn().mockResolvedValue(1),
    };
    const mod = await Test.createTestingModule({
      providers: [
        VerificationService,
        { provide: getDataSourceToken(), useValue: { query } as unknown as DataSource },
        { provide: UsersService, useValue: { getProfile } },
        { provide: REDIS_CLIENT, useValue: redis },
      ],
    }).compile();
    service = mod.get(VerificationService);
  });

  afterEach(() => {
    process.env = ORIGINAL_ENV;
  });

  describe('getLadderStatus', () => {
    it('throws when user is missing', async () => {
      query.mockResolvedValueOnce([]);
      await expect(service.getLadderStatus('ghost')).rejects.toBeInstanceOf(NotFoundException);
    });

    it('points to email when level is none', async () => {
      query.mockResolvedValueOnce([
        {
          verification_level: 'none',
          id_verification_status: 'none',
          email: 'a@b.co',
          phone: null,
        },
      ]);
      const s = await service.getLadderStatus('u1');
      expect(s.nextStep).toBe('email');
      expect(s.canStartEmail).toBe(true);
      expect(s.canStartPhone).toBe(true);
      expect(s.canStartId).toBe(true);
    });

    it('points to phone after email', async () => {
      query.mockResolvedValueOnce([
        {
          verification_level: 'email',
          id_verification_status: 'none',
          email: 'a@b.co',
          phone: null,
        },
      ]);
      const s = await service.getLadderStatus('u1');
      expect(s.nextStep).toBe('phone');
      expect(s.canStartEmail).toBe(false);
    });

    it('points to id after phone; selfie is not a step', async () => {
      query.mockResolvedValueOnce([
        {
          verification_level: 'phone',
          id_verification_status: 'none',
          email: 'a@b.co',
          phone: '+1555',
        },
      ]);
      const s = await service.getLadderStatus('u1');
      expect(s.nextStep).toBe('id');
      expect(s.canStartId).toBe(true);
    });

    it('blocks id start while pending', async () => {
      query.mockResolvedValueOnce([
        {
          verification_level: 'phone',
          id_verification_status: 'pending',
          email: 'a@b.co',
          phone: '+1555',
        },
      ]);
      const s = await service.getLadderStatus('u1');
      expect(s.nextStep).toBeNull();
      expect(s.canStartId).toBe(false);
      expect(s.message).toMatch(/review/i);
    });

    it('is complete when id verified', async () => {
      query.mockResolvedValueOnce([
        {
          verification_level: 'id',
          id_verification_status: 'verified',
          email: 'a@b.co',
          phone: '+1555',
        },
      ]);
      const s = await service.getLadderStatus('u1');
      expect(s.nextStep).toBeNull();
      expect(s.canStartId).toBe(false);
      expect(s.message).toMatch(/verified/i);
    });
  });

  describe('startPhone', () => {
    it('returns the dev channel when Twilio is not configured (non-prod)', async () => {
      await expect(service.startPhone('u1', '+15550001111')).resolves.toEqual({
        sent: true,
        channel: 'dev',
      });
    });

    it('is unavailable in production without Twilio creds', async () => {
      process.env.NODE_ENV = 'production';
      await expect(service.startPhone('u1', '+15550001111')).rejects.toBeInstanceOf(
        ServiceUnavailableException,
      );
    });
  });

  describe('checkPhone', () => {
    it('rejects an incorrect code without writing', async () => {
      await expect(service.checkPhone('u1', '+1555', '999999')).rejects.toBeInstanceOf(
        BadRequestException,
      );
      expect(query).not.toHaveBeenCalled();
    });

    it('promotes the ladder and returns the profile on the correct dev code', async () => {
      const res = await service.checkPhone('u1', '+1555', '000000');
      expect(query).toHaveBeenCalledTimes(1);
      expect(query.mock.calls[0]![0]).toContain('verification_level');
      expect(getProfile).toHaveBeenCalledWith('u1');
      expect(res).toMatchObject({ id: 'u1' });
    });

    it('maps a unique-violation to phone_taken', async () => {
      const err = new QueryFailedError('q', undefined, new Error('dup'));
      (err as unknown as { code: string }).code = '23505';
      query.mockRejectedValueOnce(err);
      await expect(service.checkPhone('u1', '+1555', '000000')).rejects.toBeInstanceOf(
        ConflictException,
      );
    });
  });

  describe('startEmail', () => {
    it('returns dev channel and stores Redis OTP when Twilio is off', async () => {
      query.mockResolvedValueOnce([{ email: 'a@b.co', verification_level: 'none' }]);
      const res = await service.startEmail('u1');
      expect(res).toEqual({
        sent: true,
        channel: 'dev',
        maskedEmail: 'a***@b.co',
      });
      expect(redis.setex).toHaveBeenCalled();
      const [key, ttl, code] = redis.setex.mock.calls[0]!;
      expect(key).toBe('verify:email:u1');
      expect(ttl).toBe(600);
      expect(code).toBe('000000');
    });

    it('no-ops when already email-verified', async () => {
      query.mockResolvedValueOnce([{ email: 'a@b.co', verification_level: 'email' }]);
      const res = await service.startEmail('u1');
      expect(res.sent).toBe(true);
      expect(redis.setex).not.toHaveBeenCalled();
    });
  });

  describe('checkEmail', () => {
    it('accepts Redis-stored OTP and promotes to email', async () => {
      query
        .mockResolvedValueOnce([{ email: 'a@b.co', verification_level: 'none' }])
        .mockResolvedValueOnce([]);
      redis.get.mockResolvedValueOnce('123456');
      getProfile.mockResolvedValueOnce({ id: 'u1', verificationLevel: 'email' });
      const res = await service.checkEmail('u1', '123456');
      expect(query.mock.calls[1]![0]).toContain('verification_level');
      expect(redis.del).toHaveBeenCalledWith('verify:email:u1');
      expect(res).toMatchObject({ id: 'u1' });
    });

    it('accepts DEV code outside production even without Redis', async () => {
      query
        .mockResolvedValueOnce([{ email: 'a@b.co', verification_level: 'none' }])
        .mockResolvedValueOnce([]);
      redis.get.mockResolvedValueOnce(null);
      getProfile.mockResolvedValueOnce({ id: 'u1', verificationLevel: 'email' });
      await expect(service.checkEmail('u1', '000000')).resolves.toMatchObject({ id: 'u1' });
    });

    it('rejects wrong code', async () => {
      query.mockResolvedValueOnce([{ email: 'a@b.co', verification_level: 'none' }]);
      redis.get.mockResolvedValueOnce('111111');
      await expect(service.checkEmail('u1', '999999')).rejects.toBeInstanceOf(
        BadRequestException,
      );
    });
  });
});
