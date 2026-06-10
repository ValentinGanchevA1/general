// apps/backend/src/modules/id-verification/id-verification.service.spec.ts
import { Test } from '@nestjs/testing';
import { DataSource } from 'typeorm';
import { getDataSourceToken } from '@nestjs/typeorm';
import { BadRequestException, NotFoundException } from '@nestjs/common';

import { IdVerificationService } from './id-verification.service';
import { S3Service } from '../../common/s3.service';

const B64 = Buffer.from('fake-image-bytes').toString('base64');

function userRow(status: string, verifiedAt: string | null = null) {
  return { id: 'u1', id_verification_status: status, id_verified_at: verifiedAt };
}

describe('IdVerificationService', () => {
  let service: IdVerificationService;
  let query: jest.Mock;
  let uploadVerificationBuffer: jest.Mock;

  beforeEach(async () => {
    // Unstubbed queries (INSERT, UPDATE) resolve empty; tests override the leading
    // SELECT call-by-call with mockResolvedValueOnce.
    query = jest.fn().mockResolvedValue([]);
    uploadVerificationBuffer = jest
      .fn()
      .mockImplementation((_userId: string, kind: string) =>
        Promise.resolve(`verifications/u1/${kind}-uuid.jpg`),
      );

    const mod = await Test.createTestingModule({
      providers: [
        IdVerificationService,
        { provide: getDataSourceToken(), useValue: { query } as unknown as DataSource },
        { provide: S3Service, useValue: { uploadVerificationBuffer } },
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

      // Server signs the real Content-Type — not a hardcoded image/jpeg.
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

      // INSERT (2nd query call) stores the keys the server generated, not client input.
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
      query.mockResolvedValueOnce([]); // requireEligible finds nobody

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
});
