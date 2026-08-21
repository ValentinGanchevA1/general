// apps/backend/src/modules/id-verification/id-verification.service.spec.ts
import { Test } from '@nestjs/testing';
import { DataSource } from 'typeorm';
import { getDataSourceToken } from '@nestjs/typeorm';
import { BadRequestException, NotFoundException } from '@nestjs/common';

import { IdVerificationService } from './id-verification.service';
import { S3Service } from '../../common/s3.service';
import { NotificationsService } from '../notifications/notifications.service';
import { RekognitionService } from './rekognition.service';
import { IdVerificationGateway } from './gateways/id-verification.gateway';

const B64 = Buffer.from('fake-image-bytes').toString('base64');

function userRow(status: string, verifiedAt: string | null = null) {
  return { id: 'u1', id_verification_status: status, id_verified_at: verifiedAt };
}

const analysisOk = {
  status: 'ok' as const,
  faceSimilarity: 92.3,
  selfieFaceCount: 1,
  idFrontFaceCount: 1,
  selfieFaceConfidence: 99,
  idFrontFaceConfidence: 97,
  error: null,
};

describe('IdVerificationService', () => {
  let service: IdVerificationService;
  let query: jest.Mock;
  let uploadVerificationBuffer: jest.Mock;
  let notifyIdVerificationDecided: jest.Mock;
  let analyzeVerification: jest.Mock;
  let emitVerificationUpdate: jest.Mock;

  beforeEach(async () => {
    query = jest.fn().mockResolvedValue([]);
    uploadVerificationBuffer = jest
      .fn()
      .mockImplementation((_userId: string, kind: string) =>
        Promise.resolve(`verifications/u1/${kind}-uuid.jpg`),
      );
    notifyIdVerificationDecided = jest.fn().mockResolvedValue(undefined);
    analyzeVerification = jest.fn().mockResolvedValue(analysisOk);
    emitVerificationUpdate = jest.fn();

    const transaction = jest.fn(async (fn: (m: { query: jest.Mock }) => Promise<unknown>) => {
      return fn({ query });
    });

    const mod = await Test.createTestingModule({
      providers: [
        IdVerificationService,
        {
          provide: getDataSourceToken(),
          useValue: { query, transaction } as unknown as DataSource,
        },
        { provide: S3Service, useValue: { uploadVerificationBuffer, verificationReadUrl: jest.fn() } },
        { provide: NotificationsService, useValue: { notifyIdVerificationDecided } },
        { provide: RekognitionService, useValue: { analyzeVerification } },
        { provide: IdVerificationGateway, useValue: { emitVerificationUpdate } },
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

    it('uploads server-side, runs assist Rekognition, inserts pending with scores', async () => {
      query.mockResolvedValueOnce([userRow('none')]); // requireEligible
      query.mockResolvedValueOnce([{ id: 'v-new' }]); // INSERT RETURNING
      query.mockResolvedValueOnce([]); // users UPDATE

      const res = await service.submitVerification('u1', payload);

      expect(res).toEqual({ status: 'pending', verificationId: 'v-new' });

      expect(uploadVerificationBuffer).toHaveBeenCalledTimes(2);
      expect(analyzeVerification).toHaveBeenCalledWith(
        'verifications/u1/selfie-uuid.jpg',
        'verifications/u1/id-front-uuid.jpg',
      );

      const insertParams = query.mock.calls[1]![1] as unknown[];
      expect(insertParams).toEqual([
        'u1',
        'verifications/u1/selfie-uuid.jpg',
        'verifications/u1/id-front-uuid.jpg',
        null,
        92.3,
        1,
        1,
        99,
        97,
        'ok',
        null,
      ]);

      expect(emitVerificationUpdate).toHaveBeenCalledWith({
        id: 'v-new',
        userId: 'u1',
        status: 'pending',
      });
    });

    it('uploads the optional ID back when provided', async () => {
      query.mockResolvedValueOnce([userRow('rejected')]);
      query.mockResolvedValueOnce([{ id: 'v-back' }]);
      query.mockResolvedValueOnce([]);

      await service.submitVerification('u1', {
        ...payload,
        idBack: B64,
        idBackContentType: 'image/heic',
      });

      expect(uploadVerificationBuffer).toHaveBeenCalledTimes(3);
      const insertParams = query.mock.calls[1]![1] as unknown[];
      expect(insertParams[3]).toBe('verifications/u1/id-back-uuid.jpg');
    });

    it('still submits pending when Rekognition returns error (fail-open)', async () => {
      query.mockResolvedValueOnce([userRow('none')]);
      query.mockResolvedValueOnce([{ id: 'v-err' }]);
      query.mockResolvedValueOnce([]);
      analyzeVerification.mockResolvedValueOnce({
        status: 'error',
        faceSimilarity: null,
        selfieFaceCount: null,
        idFrontFaceCount: null,
        selfieFaceConfidence: null,
        idFrontFaceConfidence: null,
        error: 'AccessDenied',
      });

      const res = await service.submitVerification('u1', payload);
      expect(res).toEqual({ status: 'pending', verificationId: 'v-err' });
      const insertParams = query.mock.calls[1]![1] as unknown[];
      expect(insertParams[9]).toBe('error');
      expect(insertParams[10]).toBe('AccessDenied');
    });

    it('rejects an already-verified user without uploading', async () => {
      query.mockResolvedValueOnce([userRow('verified', '2026-01-01T00:00:00Z')]);

      await expect(service.submitVerification('u1', payload)).rejects.toBeInstanceOf(
        BadRequestException,
      );
      expect(uploadVerificationBuffer).not.toHaveBeenCalled();
      expect(analyzeVerification).not.toHaveBeenCalled();
    });

    it('rejects submit while a review is already pending', async () => {
      query.mockResolvedValueOnce([userRow('pending')]);

      await expect(service.submitVerification('u1', payload)).rejects.toBeInstanceOf(
        BadRequestException,
      );
      expect(uploadVerificationBuffer).not.toHaveBeenCalled();
      expect(analyzeVerification).not.toHaveBeenCalled();
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
      query.mockResolvedValueOnce([]); // UPDATE RETURNING empty
      query.mockResolvedValueOnce([]); // fallback SELECT empty
      await expect(
        service.decideVerification('admin1', 'u1', { decision: 'approved' }),
      ).rejects.toBeInstanceOf(NotFoundException);
      expect(notifyIdVerificationDecided).not.toHaveBeenCalled();
    });

    it('throws BadRequest when the submission is not pending', async () => {
      query.mockResolvedValueOnce([]); // UPDATE RETURNING empty
      query.mockResolvedValueOnce([{ id: 'v1', status: 'verified' }]);
      await expect(
        service.decideVerification('admin1', 'u1', { decision: 'approved' }),
      ).rejects.toBeInstanceOf(BadRequestException);
      expect(notifyIdVerificationDecided).not.toHaveBeenCalled();
    });

    it('approves: atomic update both tables and notifies with no reason', async () => {
      // UPDATE ... RETURNING id
      query.mockResolvedValueOnce([{ id: 'v1' }]);
      // users UPDATE
      query.mockResolvedValueOnce([]);

      const res = await service.decideVerification('admin1', 'u1', { decision: 'approved' });

      expect(res).toEqual({ status: 'verified', verificationId: 'v1' });

      const reviewParams = query.mock.calls[0]![1] as unknown[];
      expect(reviewParams).toEqual(['verified', 'admin1', null, 'u1']);

      const userParams = query.mock.calls[1]![1] as unknown[];
      expect(userParams).toEqual(['verified', 'u1']);

      expect(notifyIdVerificationDecided).toHaveBeenCalledWith('u1', 'verified', undefined);
      expect(emitVerificationUpdate).toHaveBeenCalledWith({
        id: 'v1',
        userId: 'u1',
        status: 'verified',
      });
    });

    it('rejects: stores the reason and notifies with it', async () => {
      query.mockResolvedValueOnce([{ id: 'v1' }]);
      query.mockResolvedValueOnce([]);

      const res = await service.decideVerification('admin1', 'u1', {
        decision: 'rejected',
        reason: 'Blurry ID photo',
      });

      expect(res).toEqual({ status: 'rejected', verificationId: 'v1' });

      const reviewParams = query.mock.calls[0]![1] as unknown[];
      expect(reviewParams).toEqual(['rejected', 'admin1', 'Blurry ID photo', 'u1']);

      expect(notifyIdVerificationDecided).toHaveBeenCalledWith('u1', 'rejected', 'Blurry ID photo');
      expect(emitVerificationUpdate).toHaveBeenCalledWith({
        id: 'v1',
        userId: 'u1',
        status: 'rejected',
      });
    });

    it('throws BadRequest when concurrent decide already consumed the pending row', async () => {
      // UPDATE returns empty (race lost)
      query.mockResolvedValueOnce([]);
      // fallback SELECT shows already verified
      query.mockResolvedValueOnce([{ id: 'v1', status: 'verified' }]);

      await expect(
        service.decideVerification('admin1', 'u1', { decision: 'approved' }),
      ).rejects.toBeInstanceOf(BadRequestException);
      expect(notifyIdVerificationDecided).not.toHaveBeenCalled();
      expect(emitVerificationUpdate).not.toHaveBeenCalled();
    });
  });
});
