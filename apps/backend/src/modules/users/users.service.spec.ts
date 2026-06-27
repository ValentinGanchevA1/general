// apps/backend/src/modules/users/users.service.spec.ts
import { Test } from '@nestjs/testing';
import { DataSource } from 'typeorm';
import { getDataSourceToken } from '@nestjs/typeorm';
import { BadRequestException, NotFoundException } from '@nestjs/common';

import { UsersService } from './users.service';
import { PresenceService } from '../presence/presence.service';
import { MessagingService } from '../messaging/messaging.service';
import { BlocksService } from '../blocks/blocks.service';
import { S3Service } from '../../common/s3.service';

const USER = '11111111-1111-1111-1111-111111111111';
const PHOTO_A = 'aaaaaaaa-aaaa-4aaa-aaaa-aaaaaaaaaaaa';
const PHOTO_B = 'bbbbbbbb-bbbb-4bbb-bbbb-bbbbbbbbbbbb';

describe('UsersService — gallery photos', () => {
  let service: UsersService;
  let query: jest.Mock;

  beforeEach(async () => {
    query = jest.fn().mockResolvedValue([]);
    const mod = await Test.createTestingModule({
      providers: [
        UsersService,
        { provide: getDataSourceToken(), useValue: { query } as unknown as DataSource },
        { provide: PresenceService, useValue: {} },
        { provide: MessagingService, useValue: {} },
        { provide: S3Service, useValue: {} },
        { provide: BlocksService, useValue: {} },
      ],
    }).compile();
    service = mod.get(UsersService);
  });

  it('addPhoto appends and sets the first photo as the avatar', async () => {
    query
      .mockResolvedValueOnce([{ count: 0 }]) // count
      .mockResolvedValueOnce([]) // INSERT
      .mockResolvedValueOnce([]) // UPDATE avatar (first photo)
      .mockResolvedValueOnce([{ id: PHOTO_A, url: 'https://cdn/a.jpg', position: 0 }]); // listPhotos

    const res = await service.addPhoto(USER, 'https://cdn/a.jpg');
    expect(res).toHaveLength(1);
    // avatar UPDATE only fires for the first photo.
    const avatarUpdate = query.mock.calls.find((c) => /SET avatar_url = \$2/.test(c[0]));
    expect(avatarUpdate).toBeDefined();
  });

  it('addPhoto does not touch the avatar for a non-first photo', async () => {
    query
      .mockResolvedValueOnce([{ count: 2 }]) // count
      .mockResolvedValueOnce([]) // INSERT
      .mockResolvedValueOnce([]); // listPhotos
    await service.addPhoto(USER, 'https://cdn/c.jpg');
    const avatarUpdate = query.mock.calls.find((c) => /SET avatar_url = \$2/.test(c[0]));
    expect(avatarUpdate).toBeUndefined();
  });

  it('addPhoto rejects past the cap of 6', async () => {
    query.mockResolvedValueOnce([{ count: 6 }]);
    await expect(service.addPhoto(USER, 'https://cdn/x.jpg')).rejects.toBeInstanceOf(
      BadRequestException,
    );
    // No INSERT should have run.
    expect(query.mock.calls.some((c) => /INSERT INTO user_photos/.test(c[0]))).toBe(false);
  });

  it('deletePhoto throws when the photo is not the user’s', async () => {
    query.mockResolvedValueOnce([[], 0]); // DELETE ... RETURNING → nothing
    await expect(service.deletePhoto(USER, PHOTO_A)).rejects.toBeInstanceOf(NotFoundException);
  });

  it('deletePhoto resyncs the avatar after a successful delete', async () => {
    query
      .mockResolvedValueOnce([[{ id: PHOTO_A }], 1]) // DELETE RETURNING
      .mockResolvedValueOnce([]) // syncAvatar UPDATE
      .mockResolvedValueOnce([{ id: PHOTO_B, url: 'https://cdn/b.jpg', position: 0 }]); // listPhotos
    const res = await service.deletePhoto(USER, PHOTO_A);
    expect(res).toEqual([{ id: PHOTO_B, url: 'https://cdn/b.jpg', position: 0 }]);
    expect(query.mock.calls.some((c) => /SET avatar_url = \(/.test(c[0]))).toBe(true);
  });

  it('reorderPhotos rejects an id set that does not match the gallery', async () => {
    query.mockResolvedValueOnce([
      { id: PHOTO_A, url: 'https://cdn/a.jpg', position: 0 },
      { id: PHOTO_B, url: 'https://cdn/b.jpg', position: 1 },
    ]); // listPhotos
    await expect(service.reorderPhotos(USER, [PHOTO_A])).rejects.toBeInstanceOf(BadRequestException);
  });

  it('reorderPhotos applies the new order and resyncs the avatar', async () => {
    query
      .mockResolvedValueOnce([
        { id: PHOTO_A, url: 'https://cdn/a.jpg', position: 0 },
        { id: PHOTO_B, url: 'https://cdn/b.jpg', position: 1 },
      ]) // listPhotos (validation)
      .mockResolvedValueOnce([]) // UPDATE positions
      .mockResolvedValueOnce([]) // syncAvatar
      .mockResolvedValueOnce([
        { id: PHOTO_B, url: 'https://cdn/b.jpg', position: 0 },
        { id: PHOTO_A, url: 'https://cdn/a.jpg', position: 1 },
      ]); // listPhotos (result)
    const res = await service.reorderPhotos(USER, [PHOTO_B, PHOTO_A]);
    expect(res[0]?.id).toBe(PHOTO_B);
    expect(query.mock.calls.some((c) => /UPDATE user_photos AS up SET position/.test(c[0]))).toBe(
      true,
    );
  });
});

describe('UsersService — public profile trust fields', () => {
  let service: UsersService;
  let query: jest.Mock;
  const whichAreOnline = jest.fn().mockResolvedValue(new Set<string>());
  const hasBlocked = jest.fn().mockResolvedValue(false);
  const permissionFor = jest
    .fn()
    .mockResolvedValue({ matched: false, sharedInterests: [], canMessage: 'none', conversation: null });

  beforeEach(async () => {
    query = jest.fn().mockResolvedValue([]);
    hasBlocked.mockClear().mockResolvedValue(false);
    const mod = await Test.createTestingModule({
      providers: [
        UsersService,
        { provide: getDataSourceToken(), useValue: { query } as unknown as DataSource },
        { provide: PresenceService, useValue: { whichAreOnline } },
        { provide: MessagingService, useValue: { permissionFor } },
        { provide: S3Service, useValue: {} },
        { provide: BlocksService, useValue: { hasBlocked } },
      ],
    }).compile();
    service = mod.get(UsersService);
  });

  it('exposes verificationScore + idVerified derived from the ladder/ID status', async () => {
    query.mockResolvedValueOnce([
      {
        id: USER,
        display_name: 'Ada',
        avatar_url: null,
        bio: null,
        verification_level: 'phone',
        id_verification_status: 'verified',
        goals: [],
      },
    ]);
    const profile = await service.getPublicProfile(USER);
    expect(profile.verificationScore).toBe(45); // phone rung
    expect(profile.idVerified).toBe(true);
    // No viewerId passed → no relationship block (and no messaging call).
    expect(profile.relationship).toBeUndefined();
  });

  it('reports idVerified=false when the ID is only pending', async () => {
    query.mockResolvedValueOnce([
      {
        id: USER,
        display_name: 'Grace',
        avatar_url: null,
        bio: null,
        verification_level: 'none',
        id_verification_status: 'pending',
        goals: [],
      },
    ]);
    const profile = await service.getPublicProfile(USER);
    expect(profile.verificationScore).toBe(0);
    expect(profile.idVerified).toBe(false);
  });

  it('sets blockedByViewer (directional) when a viewer has blocked the subject', async () => {
    hasBlocked.mockResolvedValueOnce(true);
    query.mockResolvedValueOnce([
      {
        id: USER,
        display_name: 'Ada',
        avatar_url: null,
        bio: null,
        verification_level: 'none',
        id_verification_status: 'none',
        goals: [],
      },
    ]);
    const VIEWER = '99999999-9999-4999-9999-999999999999';
    const profile = await service.getPublicProfile(USER, VIEWER);
    expect(profile.blockedByViewer).toBe(true);
    expect(hasBlocked).toHaveBeenCalledWith(VIEWER, USER);
  });

  it('omits blockedByViewer when no viewer is supplied', async () => {
    query.mockResolvedValueOnce([
      {
        id: USER,
        display_name: 'Ada',
        avatar_url: null,
        bio: null,
        verification_level: 'none',
        id_verification_status: 'none',
        goals: [],
      },
    ]);
    const profile = await service.getPublicProfile(USER);
    expect(profile.blockedByViewer).toBeUndefined();
    expect(hasBlocked).not.toHaveBeenCalled();
  });
});

describe('UsersService — profile createdAt', () => {
  let service: UsersService;
  let query: jest.Mock;

  const buildRow = (createdAt: unknown) => ({
    id: USER,
    email: 'a@b.co',
    display_name: 'Ada',
    avatar_url: null,
    bio: null,
    verification_level: 'none',
    visibility: 'public',
    goals: [],
    interests: [],
    phone: null,
    age: null,
    subscription_tier: 'free',
    id_verification_status: 'none',
    created_at: createdAt,
  });

  beforeEach(async () => {
    query = jest.fn();
    const mod = await Test.createTestingModule({
      providers: [
        UsersService,
        { provide: getDataSourceToken(), useValue: { query } as unknown as DataSource },
        { provide: PresenceService, useValue: {} },
        { provide: MessagingService, useValue: {} },
        { provide: S3Service, useValue: {} },
        { provide: BlocksService, useValue: {} },
      ],
    }).compile();
    service = mod.get(UsersService);
  });

  // getProfile: user row → getPhotoUrls → getSocialLinks
  const mockProfileReads = (createdAt: unknown): void => {
    query
      .mockResolvedValueOnce([buildRow(createdAt)]) // SELECT user
      .mockResolvedValueOnce([]) // photos
      .mockResolvedValueOnce([]); // social links
  };

  it('passes through a valid created_at as ISO', async () => {
    mockProfileReads('2026-06-01T12:00:00.000Z');
    const profile = await service.getProfile(USER);
    expect(profile.createdAt).toBe('2026-06-01T12:00:00.000Z');
  });

  it('falls back to a valid ISO (no RangeError) when created_at is null/invalid', async () => {
    mockProfileReads(null);
    const profile = await service.getProfile(USER);
    // Must not throw and must be a parseable ISO timestamp.
    expect(Number.isNaN(Date.parse(profile.createdAt))).toBe(false);
  });
});

describe('UsersService — deleteAccount', () => {
  let service: UsersService;
  let query: jest.Mock;
  let runnerQuery: jest.Mock;
  let markOffline: jest.Mock;
  let deleteUserObjects: jest.Mock;

  beforeEach(async () => {
    query = jest.fn().mockResolvedValue([]);
    runnerQuery = jest.fn().mockResolvedValue([]);
    markOffline = jest.fn().mockResolvedValue(undefined);
    deleteUserObjects = jest.fn().mockResolvedValue(0);
    const createQueryRunner = jest.fn().mockReturnValue({
      connect: jest.fn().mockResolvedValue(undefined),
      startTransaction: jest.fn().mockResolvedValue(undefined),
      commitTransaction: jest.fn().mockResolvedValue(undefined),
      rollbackTransaction: jest.fn().mockResolvedValue(undefined),
      release: jest.fn().mockResolvedValue(undefined),
      query: runnerQuery,
    });
    const mod = await Test.createTestingModule({
      providers: [
        UsersService,
        {
          provide: getDataSourceToken(),
          useValue: { query, createQueryRunner } as unknown as DataSource,
        },
        { provide: PresenceService, useValue: { markOffline } },
        { provide: MessagingService, useValue: {} },
        { provide: S3Service, useValue: { deleteUserObjects } },
        { provide: BlocksService, useValue: {} },
      ],
    }).compile();
    service = mod.get(UsersService);
  });

  it('rejects without the literal confirm phrase and never touches the DB', async () => {
    await expect(service.deleteAccount(USER, 'delete')).rejects.toBeInstanceOf(BadRequestException);
    expect(query).not.toHaveBeenCalled();
    expect(runnerQuery).not.toHaveBeenCalled();
  });

  it('deletes an OAuth-only account (null hash) — purges external state + cascades', async () => {
    query.mockResolvedValueOnce([{ id: USER, password_hash: null }]); // SELECT user
    await service.deleteAccount(USER, 'DELETE');

    expect(markOffline).toHaveBeenCalledWith(USER);
    expect(deleteUserObjects).toHaveBeenCalledWith(USER);
    // conversations cleared (array isn't an FK) then the user row (cascades the rest).
    expect(runnerQuery.mock.calls.some((c) => /DELETE FROM conversations/.test(c[0]))).toBe(true);
    expect(runnerQuery.mock.calls.some((c) => /DELETE FROM users/.test(c[0]))).toBe(true);
  });

  it('rejects a password account when the password is wrong', async () => {
    // bcrypt hash of 'correct-pw'; 'wrong-pw' will not match.
    const hash = '$2b$10$N9qo8uLOickgx2ZMRZoMy.Mrq4n0Z5Q1l8t9xq1Z5Q1l8t9xq1Zu';
    query.mockResolvedValueOnce([{ id: USER, password_hash: hash }]);
    await expect(service.deleteAccount(USER, 'DELETE', 'wrong-pw')).rejects.toMatchObject({
      response: { code: 'account.password_mismatch' },
    });
    expect(runnerQuery).not.toHaveBeenCalled();
  });
});
