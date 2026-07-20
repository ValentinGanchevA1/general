// apps/backend/src/modules/id-verification/id-verification.service.spec.ts
import { Test } from '@nestjs/testing';
import { DataSource, QueryRunner } from 'typeorm';
import { getDataSourceToken } from '@nestjs/typeorm';
import { BadRequestException, NotFoundException } from '@nestjs/common';

import { IdVerificationService } from './id-verification.service';
import { S3Service } from '../../common/s3.service';
import { NotificationsService } from '../notifications/notifications.service';

const B64 = Buffer.from('fake-image-bytes').toString('base64');

function userRow(status: string, verifiedAt: string | null = null) {
  return { id: 'u1', id_verification_status: status, id_verified_at: verifiedAt };
}

describe('IdVerificationService', () => {
  let service: IdVerificationService;
  let query: jest.Mock;
  let transaction: jest.Mock;
  let uploadVerificationBuffer: jest.Mock;
  let notifyIdVerificationDecided: jest.Mock;

  beforeEach(async () => {
    // Unstubbed queries (INSERT, UPDATE) resolve empty; tests override the leading
    // SELECT call-by-call with mockResolvedValueOnce.
    query = jest.fn().mockResolvedValue([]);
    
    // Mock the transaction method to execute the callback directly
    transaction = jest.fn().mockImplementation((callback) => callback({
      query,
    } as unknown as QueryRunner));
    
    uploadVerificationBuffer = jest
      .fn()
      .mockImplementation((_userId: string, kind: string) =>
        Promise.resolve(`verifications/u1/${kind}-uuid.jpg`),
      );
    notifyIdVerificationDecided = jest.fn().mockResolvedValue(undefined);

    const mod = await Test.createTestingModule({
      providers: [
        IdVerificationService,
        { provide: getDataSourceToken(), useValue: { query, transaction } as unknown as DataSource },
        { provide: S3Service, useValue: { uploadVerificationBuffer } },
        { provide: NotificationsService, useValue: { notifyIdVerificationDecided } },
      ],
    }).compile();
    service = mod.get(IdVerificationService);
  });

  describe('submitVerification', () => {
    const payload = {
      selfie: B64,
      selfieContentType: 'image/png',
      idFront: B64,
      idFrontContentType: 'image/jpeg',
    };

    it('uploads server-side and inserts a pending row keyed by server-generated keys', async () => {
      query.mockResolvedValueOnce([userRow('none')]); // requireEligible

      const res = await service.submitVerification('u1', payload);

      expect(res).toEqual({ status: 'pending' });

      expect(uploadVerificationBuffer).toHaveBeenCalledTimes(2);
      expect(uploadVerificationBuffer).toHaveBeenCalledWith(
        'u1',
        'selfie',
        expect.any(Buffer),
        'image/png',
      );
      expect(uploadVerificationBuffer).toHaveBeenCalledWith(
        'u1',
        'id-front',
        expect.any(Buffer),
        'image/jpeg',
      );

      const insertParams = query.mock.calls[1]![1] as unknown[];
      expect(insertParams).toEqual([
        'u1',
        'verifications/u1/selfie-uuid.jpg',
        'verifications/u1/id-front-uuid.jpg',
        null,
      ]);
    });

    it('uploads the optional ID back when provided', async () => {
      query.mockResolvedValueOnce([userRow('rejected')]);

      await service.submitVerification('u1', {
        ...payload,
        idBack: B64,
        idBackContentType: 'image/heic',
      });

      expect(uploadVerificationBuffer).toHaveBeenCalledTimes(3);
      expect(uploadVerificationBuffer).toHaveBeenCalledWith(
        'u1',
        'id-back',
        expect.any(Buffer),
        'image/heic',
      );
      const insertParams = query.mock.calls[1]![1] as unknown[];
      expect(insertParams[3]).toBe('verifications/u1/id-back-uuid.jpg');
    });

    it('rejects an already-verified user without uploading', async () => {
      query.mockResolvedValueOnce([userRow('verified', '2026-01-01T00:00:00Z')]);

      await expect(service.submitVerification('u1', payload)).rejects.toBeInstanceOf(
        BadRequestException,
      );
      expect(uploadVerificationBuffer).not.toHaveBeenCalled();
    });

    it('throws NotFound when the user does not exist', async () => {
      query.mockResolvedValueOnce([]);

      await expect(service.submitVerification('u1', payload)).rejects.toBeInstanceOf(
        NotFoundException,
      );
      expect(uploadVerificationBuffer).not.toHaveBeenCalled();
    });

    it('rejects an empty image without uploading', async () => {
      query.mockResolvedValueOnce([userRow('none')]);

      await expect(
        service.submitVerification('u1', { ...payload, selfie: '' }),
      ).rejects.toBeInstanceOf(BadRequestException);
      expect(uploadVerificationBuffer).not.toHaveBeenCalled();
    });
  });

  describe('startVerification', () => {
    it('returns the current status for an eligible user', async () => {
      query.mockResolvedValueOnce([userRow('rejected')]);
      await expect(service.startVerification('u1')).resolves.toEqual({ status: 'rejected' });
    });

    it('rejects when already verified', async () => {
      query.mockResolvedValueOnce([userRow('verified')]);
      await expect(service.startVerification('u1')).rejects.toBeInstanceOf(BadRequestException);
    });
  });

  describe('getStatus', () => {
    it('returns status and verifiedAt', async () => {
      query.mockResolvedValueOnce([userRow('verified', '2026-02-01T00:00:00Z')]);
      await expect(service.getStatus('u1')).resolves.toEqual({
        status: 'verified',
        verifiedAt: '2026-02-01T00:00:00Z',
      });
    });

    it('throws NotFound when the user is missing', async () => {
      query.mockResolvedValueOnce([]);
      await expect(service.getStatus('u1')).rejects.toBeInstanceOf(NotFoundException);
    });
  });

  describe('decideVerification', () => {
    it('throws NotFound when no submission exists for the user', async () => {
      query.mockResolvedValueOnce([]); // SELECT latest submission
      await expect(
        service.decideVerification('admin1', 'u1', { decision: 'approved' }),
      ).rejects.toBeInstanceOf(NotFoundException);
      expect(notifyIdVerificationDecided).not.toHaveBeenCalled();
    });

    it('throws BadRequest when the submission is not pending', async () => {
      query.mockResolvedValueOnce([{ id: 'v1', status: 'verified' }]);
      await expect(
        service.decideVerification('admin1', 'u1', { decision: 'approved' }),
      ).rejects.toBeInstanceOf(BadRequestException);
      expect(notifyIdVerificationDecided).not.toHaveBeenCalled();
    });

    it('approves: updates both tables in a transaction and notifies with no reason', async () => {
      query.mockResolvedValueOnce([{ id: 'v1', status: 'pending' }]); // SELECT
      query.mockResolvedValueOnce(1); // UPDATE user_id_verifications (1 row affected)
      query.mockResolvedValueOnce(1); // UPDATE users

      const res = await service.decideVerification('admin1', 'u1', { decision: 'approved' });

      expect(res).toEqual({ status: 'verified' });

      // Verify transaction was called
      expect(transaction).toHaveBeenCalled();

      // UPDATE user_id_verifications (1st query inside transaction)
      const reviewParams = query.mock.calls[1]![1] as unknown[];
      expect(reviewParams).toEqual(['verified', 'admin1', null, 'v1']);

      // UPDATE users (2nd query inside transaction)
      const userParams = query.mock.calls[2]![1] as unknown[];
      expect(userParams).toEqual(['verified', 'u1']);

      expect(notifyIdVerificationDecided).toHaveBeenCalledWith('u1', 'verified', undefined);
    });

    it('rejects: stores the reason and notifies with it', async () => {
      query.mockResolvedValueOnce([{ id: 'v1', status: 'pending' }]);
      query.mockResolvedValueOnce(1); // UPDATE user_id_verifications
      query.mockResolvedValueOnce(1); // UPDATE users

      const res = await service.decideVerification('admin1', 'u1', {
        decision: 'rejected',
        reason: 'Blurry ID photo',
      });

      expect(res).toEqual({ status: 'rejected' });

      const reviewParams = query.mock.calls[1]![1] as unknown[];
      expect(reviewParams).toEqual(['rejected', 'admin1', 'Blurry ID photo', 'v1']);

      expect(notifyIdVerificationDecided).toHaveBeenCalledWith('u1', 'rejected', 'Blurry ID photo');
    });

    it('throws BadRequest if concurrent admin already processed the verification', async () => {
      query.mockResolvedValueOnce([{ id: 'v1', status: 'pending' }]); // SELECT
      query.mockResolvedValueOnce(0); // UPDATE user_id_verifications (0 rows affected - already processed)

      await expect(
        service.decideVerification('admin1', 'u1', { decision: 'approved' }),
      ).rejects.toBeInstanceOf(BadRequestException);
      expect(notifyIdVerificationDecided).not.toHaveBeenCalled();
    });
  });
});
