import { Test } from '@nestjs/testing';
import { DataSource, QueryFailedError } from 'typeorm';
import { getDataSourceToken } from '@nestjs/typeorm';
import {
  BadRequestException,
  ConflictException,
  ServiceUnavailableException,
} from '@nestjs/common';

import { VerificationService } from './verification.service';
import { UsersService } from '../users/users.service';

const ORIGINAL_ENV = process.env;

describe('VerificationService', () => {
  let service: VerificationService;
  let query: jest.Mock;
  let getProfile: jest.Mock;

  beforeEach(async () => {
    // Dev mode: no Twilio creds, not production -> fixed dev code path.
    process.env = { ...ORIGINAL_ENV, NODE_ENV: 'test' };
    delete process.env.TWILIO_ACCOUNT_SID;
    delete process.env.TWILIO_AUTH_TOKEN;
    delete process.env.TWILIO_VERIFY_SERVICE_SID;
    delete process.env.DEV_OTP_CODE;

    query = jest.fn().mockResolvedValue([]);
    getProfile = jest.fn().mockResolvedValue({ id: 'u1', verificationLevel: 'phone' });
    const mod = await Test.createTestingModule({
      providers: [
        VerificationService,
        { provide: getDataSourceToken(), useValue: { query } as unknown as DataSource },
        { provide: UsersService, useValue: { getProfile } },
      ],
    }).compile();
    service = mod.get(VerificationService);
  });

  afterEach(() => {
    process.env = ORIGINAL_ENV;
  });

  describe('startPhone', () => {
    it('returns the dev channel when Twilio is not configured (non-prod)', async () => {
      await expect(service.startPhone('+15550001111')).resolves.toEqual({
        sent: true,
        channel: 'dev',
      });
    });

    it('is unavailable in production without Twilio creds', async () => {
      process.env.NODE_ENV = 'production';
      await expect(service.startPhone('+15550001111')).rejects.toBeInstanceOf(
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
});
