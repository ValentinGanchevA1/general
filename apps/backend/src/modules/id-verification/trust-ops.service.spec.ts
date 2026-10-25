import {
  BadRequestException,
  ConflictException,
} from '@nestjs/common';
import type { DataSource } from 'typeorm';

import { S3Service } from '../../common/s3.service';
import { NotificationsService } from '../notifications/notifications.service';
import { IdVerificationService } from './id-verification.service';
import { RekognitionService } from './rekognition.service';
import { IdVerificationGateway } from './gateways/id-verification.gateway';

const B64 = Buffer.from('fake-image-bytes').toString('base64');

function createService(options?: {
  dbQuery?: jest.Mock;
  managerQuery?: jest.Mock;
}) {
  const dbQuery = options?.dbQuery ?? jest.fn().mockResolvedValue([]);
  const managerQuery = options?.managerQuery ?? jest.fn().mockResolvedValue([]);
  const transaction = jest.fn(
    async (fn: (manager: { query: jest.Mock }) => Promise<unknown>) =>
      fn({ query: managerQuery }),
  );

  const deleteObjectsByKeys = jest.fn().mockResolvedValue(0);
  const uploadVerificationBuffer = jest
    .fn()
    .mockImplementation((_userId: string, kind: string) =>
      Promise.resolve(`verifications/u1/${kind}-uuid.jpg`),
    );
  const notifyIdVerificationDecided = jest.fn().mockResolvedValue(undefined);
  const emitVerificationUpdate = jest.fn();
  const analyzeVerification = jest.fn().mockResolvedValue({
    status: 'ok',
    faceSimilarity: 95,
    selfieFaceCount: 1,
    idFrontFaceCount: 1,
    selfieFaceConfidence: 99,
    idFrontFaceConfidence: 99,
    error: null,
  });
  const getReadiness = jest.fn().mockReturnValue({
    enabled: true,
    configured: true,
    region: 'eu-north-1',
    status: 'ready',
    issue: null,
  });

  const service = new IdVerificationService(
    { query: dbQuery, transaction } as unknown as DataSource,
    {
      uploadVerificationBuffer,
      deleteObjectsByKeys,
      verificationReadUrl: jest.fn(),
    } as unknown as S3Service,
    { notifyIdVerificationDecided } as unknown as NotificationsService,
    { analyzeVerification, getReadiness } as unknown as RekognitionService,
    { emitVerificationUpdate } as unknown as IdVerificationGateway,
  );

  return {
    service,
    dbQuery,
    managerQuery,
    transaction,
    deleteObjectsByKeys,
    uploadVerificationBuffer,
    notifyIdVerificationDecided,
    emitVerificationUpdate,
    getReadiness,
  };
}

describe('Trust Ops hardening', () => {
  const originalAdminIds = process.env.ADMIN_USER_IDS;
  const originalBucket = process.env.AWS_S3_BUCKET;
  const originalRegion = process.env.AWS_REGION;

  afterEach(() => {
    jest.restoreAllMocks();
    if (originalAdminIds === undefined) delete process.env.ADMIN_USER_IDS;
    else process.env.ADMIN_USER_IDS = originalAdminIds;
    if (originalBucket === undefined) delete process.env.AWS_S3_BUCKET;
    else process.env.AWS_S3_BUCKET = originalBucket;
    if (originalRegion === undefined) delete process.env.AWS_REGION;
    else process.env.AWS_REGION = originalRegion;
  });

  it('deletes already-uploaded verification media when DB persistence fails', async () => {
    const dbQuery = jest
      .fn()
      .mockResolvedValueOnce([
        { id: 'u1', id_verification_status: 'none', id_verified_at: null },
      ]);
    const managerQuery = jest.fn().mockRejectedValueOnce(new Error('db unavailable'));
    const { service, deleteObjectsByKeys } = createService({ dbQuery, managerQuery });

    await expect(
      service.submitVerification('u1', {
        selfie: B64,
        selfieContentType: 'image/jpeg',
        idFront: B64,
        idFrontContentType: 'image/jpeg',
      }),
    ).rejects.toThrow('db unavailable');

    expect(deleteObjectsByKeys).toHaveBeenCalledWith([
      'verifications/u1/selfie-uuid.jpg',
      'verifications/u1/id-front-uuid.jpg',
    ]);
  });

  it('maps a concurrent pending unique violation to a safe client error and cleans media', async () => {
    const dbQuery = jest
      .fn()
      .mockResolvedValueOnce([
        { id: 'u1', id_verification_status: 'none', id_verified_at: null },
      ]);
    const unique = Object.assign(new Error('duplicate key'), { code: '23505' });
    const managerQuery = jest.fn().mockRejectedValueOnce(unique);
    const { service, deleteObjectsByKeys } = createService({ dbQuery, managerQuery });

    await expect(
      service.submitVerification('u1', {
        selfie: B64,
        selfieContentType: 'image/png',
        idFront: B64,
        idFrontContentType: 'image/jpeg',
      }),
    ).rejects.toEqual(new BadRequestException('Verification already pending review'));

    expect(deleteObjectsByKeys).toHaveBeenCalledTimes(1);
  });

  it('replays the same final admin decision without duplicate side effects', async () => {
    const dbQuery = jest
      .fn()
      .mockResolvedValueOnce([{ id: 'v1', status: 'verified' }]);
    const { service, notifyIdVerificationDecided, emitVerificationUpdate } = createService({
      dbQuery,
    });
    jest
      .spyOn(service, 'decideVerification')
      .mockRejectedValueOnce(new BadRequestException('Submission already verified'));

    await expect(
      service.decideVerificationIdempotent('admin1', 'u1', { decision: 'approved' }),
    ).resolves.toEqual({ status: 'verified', verificationId: 'v1' });

    expect(notifyIdVerificationDecided).not.toHaveBeenCalled();
    expect(emitVerificationUpdate).not.toHaveBeenCalled();
  });

  it('rejects a contradictory admin retry with 409 semantics', async () => {
    const dbQuery = jest
      .fn()
      .mockResolvedValueOnce([{ id: 'v1', status: 'verified' }]);
    const { service } = createService({ dbQuery });
    jest
      .spyOn(service, 'decideVerification')
      .mockRejectedValueOnce(new BadRequestException('Submission already verified'));

    await expect(
      service.decideVerificationIdempotent('admin1', 'u1', {
        decision: 'rejected',
        reason: 'Mismatch',
      }),
    ).rejects.toBeInstanceOf(ConflictException);
  });

  it('returns a secret-free production readiness summary', () => {
    process.env.ADMIN_USER_IDS = 'admin-a,admin-b';
    process.env.AWS_S3_BUCKET = 'private-verifications';
    process.env.AWS_REGION = 'eu-north-1';
    const { service } = createService();

    const result = service.getOperationalReadiness();

    expect(result.ready).toBe(true);
    expect(result.checks.adminUserCount).toBe(2);
    expect(result.checks.adminUsersConfigured).toBe(true);
    expect(result.checks.rekognition.status).toBe('ready');
    expect(JSON.stringify(result)).not.toContain('admin-a');
    expect(JSON.stringify(result)).not.toContain('private-verifications');
  });
});
