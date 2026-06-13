// apps/backend/src/modules/users/users.service.spec.ts
import { Test } from '@nestjs/testing';
import { DataSource } from 'typeorm';
import { getDataSourceToken } from '@nestjs/typeorm';
import { BadRequestException, NotFoundException } from '@nestjs/common';

import { UsersService } from './users.service';
import { PresenceService } from '../presence/presence.service';
import { MessagingService } from '../messaging/messaging.service';

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

  beforeEach(async () => {
    query = jest.fn().mockResolvedValue([]);
    const mod = await Test.createTestingModule({
      providers: [
        UsersService,
        { provide: getDataSourceToken(), useValue: { query } as unknown as DataSource },
        { provide: PresenceService, useValue: { whichAreOnline } },
        { provide: MessagingService, useValue: {} },
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
