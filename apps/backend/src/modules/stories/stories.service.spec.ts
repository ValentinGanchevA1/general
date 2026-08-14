import { Test } from '@nestjs/testing';
import { getDataSourceToken } from '@nestjs/typeorm';
import {
  BadRequestException,
  ForbiddenException,
  HttpException,
  NotFoundException,
} from '@nestjs/common';
import type { DataSource } from 'typeorm';

import { STORY_LIMITS } from '@g88/shared';

import { S3Service } from '../../common/s3.service';
import { REDIS_CLIENT } from '../../config/redis.provider';
import { RealtimeGateway } from '../../realtime/realtime.gateway';
import {
  StoriesService,
  STORY_PRESIGN_TTL_SEC,
  storyPresignRedisKey,
} from './stories.service';

describe('StoriesService', () => {
  let service: StoriesService;
  let query: jest.Mock;
  let redisGet: jest.Mock;
  let redisSet: jest.Mock;
  let redisDel: jest.Mock;
  let storyPresignedUrl: jest.Mock;
  let emitStoryNew: jest.Mock;

  const USER = 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa';
  const PUBLIC =
    'https://g88-uploads-dev.s3.eu-north-1.amazonaws.com/stories/' +
    USER +
    '/abc123.jpg';
  const EXTERNAL = 'https://evil.example/pwn.jpg';

  beforeEach(async () => {
    query = jest.fn().mockResolvedValue([]);
    redisGet = jest.fn().mockResolvedValue(null);
    redisSet = jest.fn().mockResolvedValue('OK');
    redisDel = jest.fn().mockResolvedValue(1);
    storyPresignedUrl = jest.fn().mockResolvedValue({
      uploadUrl: 'https://s3.example/put',
      publicUrl: PUBLIC,
    });
    emitStoryNew = jest.fn();

    const mod = await Test.createTestingModule({
      providers: [
        StoriesService,
        {
          provide: getDataSourceToken(),
          useValue: { query } as unknown as DataSource,
        },
        { provide: S3Service, useValue: { storyPresignedUrl } },
        { provide: RealtimeGateway, useValue: { emitStoryNew } },
        {
          provide: REDIS_CLIENT,
          useValue: { get: redisGet, set: redisSet, del: redisDel },
        },
      ],
    }).compile();
    service = mod.get(StoriesService);
  });

  /** User row that passes the soft gate (phone skips age). */
  function gateOkUser(
    level: 'email' | 'phone' | 'none' = 'phone',
    createdAt = new Date('2020-01-01T00:00:00Z'),
  ) {
    return [{ verification_level: level, created_at: createdAt }];
  }

  describe('assertCanPost / gate', () => {
    it('rejects when email is unverified (none)', async () => {
      query.mockResolvedValueOnce([{ verification_level: 'none', created_at: new Date() }]);
      await expect(
        service.presign(USER, { contentType: 'image/jpeg' }),
      ).rejects.toBeInstanceOf(ForbiddenException);
      expect(storyPresignedUrl).not.toHaveBeenCalled();
    });

    it('rejects email-only accounts younger than 24h', async () => {
      query.mockResolvedValueOnce([
        { verification_level: 'email', created_at: new Date() },
      ]);
      await expect(
        service.presign(USER, { contentType: 'image/jpeg' }),
      ).rejects.toBeInstanceOf(ForbiddenException);
      expect(storyPresignedUrl).not.toHaveBeenCalled();
    });

    it('allows phone+ regardless of account age', async () => {
      query
        .mockResolvedValueOnce(gateOkUser('phone', new Date()))
        .mockResolvedValueOnce([{ n: 0 }]);
      const res = await service.presign(USER, { contentType: 'image/jpeg' });
      expect(res.publicUrl).toBe(PUBLIC);
      expect(storyPresignedUrl).toHaveBeenCalledWith(USER, 'image/jpeg');
    });

    it('rate-limits email-only at softerGateMaxPer24h', async () => {
      const old = new Date(Date.now() - 48 * 3600_000);
      query
        .mockResolvedValueOnce(gateOkUser('email', old))
        .mockResolvedValueOnce([{ n: STORY_LIMITS.softerGateMaxPer24h }]);
      await expect(
        service.presign(USER, { contentType: 'image/jpeg' }),
      ).rejects.toBeInstanceOf(HttpException);
      expect(storyPresignedUrl).not.toHaveBeenCalled();
    });

    it('rate-limits phone+ at phoneVerifiedMaxPer24h', async () => {
      query
        .mockResolvedValueOnce(gateOkUser('phone'))
        .mockResolvedValueOnce([{ n: STORY_LIMITS.phoneVerifiedMaxPer24h }]);
      await expect(
        service.presign(USER, { contentType: 'image/jpeg' }),
      ).rejects.toBeInstanceOf(HttpException);
    });
  });

  describe('presign — Redis binding', () => {
    it('stores publicUrl under story:presign:{userId} with 300s TTL', async () => {
      query
        .mockResolvedValueOnce(gateOkUser())
        .mockResolvedValueOnce([{ n: 0 }]);
      await service.presign(USER, { contentType: 'image/jpeg' });
      expect(redisSet).toHaveBeenCalledWith(
        storyPresignRedisKey(USER),
        PUBLIC,
        'EX',
        STORY_PRESIGN_TTL_SEC,
      );
      expect(STORY_PRESIGN_TTL_SEC).toBe(300);
    });
  });

  describe('create — mediaUrl verification', () => {
    it('rejects when no presign binding exists in Redis', async () => {
      query
        .mockResolvedValueOnce(gateOkUser())
        .mockResolvedValueOnce([{ n: 0 }]);
      redisGet.mockResolvedValueOnce(null);
      await expect(
        service.create(USER, {
          mediaUrl: PUBLIC,
          mediaType: 'image',
          location: { lat: 42.7, lng: 23.3 },
        }),
      ).rejects.toBeInstanceOf(BadRequestException);
      expect(redisGet).toHaveBeenCalledWith(storyPresignRedisKey(USER));
    });

    it('rejects an external mediaUrl that does not match the presign', async () => {
      query
        .mockResolvedValueOnce(gateOkUser())
        .mockResolvedValueOnce([{ n: 0 }]);
      redisGet.mockResolvedValueOnce(PUBLIC);
      await expect(
        service.create(USER, {
          mediaUrl: EXTERNAL,
          mediaType: 'image',
          location: { lat: 42.7, lng: 23.3 },
        }),
      ).rejects.toMatchObject({
        response: expect.objectContaining({ code: 'story.media_url_mismatch' }),
      });
    });

    it('rejects a stories/ path belonging to another user', async () => {
      const other =
        'https://g88-uploads-dev.s3.eu-north-1.amazonaws.com/stories/bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb/x.jpg';
      query
        .mockResolvedValueOnce(gateOkUser())
        .mockResolvedValueOnce([{ n: 0 }]);
      redisGet.mockResolvedValueOnce(other);
      await expect(
        service.create(USER, {
          mediaUrl: other,
          mediaType: 'image',
          location: { lat: 42.7, lng: 23.3 },
        }),
      ).rejects.toBeInstanceOf(BadRequestException);
    });

    it('accepts matching presign publicUrl, inserts, consumes Redis key, emits', async () => {
      const now = new Date('2026-08-14T00:00:00Z');
      query
        .mockResolvedValueOnce(gateOkUser())
        .mockResolvedValueOnce([{ n: 0 }])
        .mockResolvedValueOnce([{ n: 0 }])
        .mockResolvedValueOnce([
          {
            id: 'story-1',
            author_id: USER,
            media_url: PUBLIC,
            media_type: 'image',
            caption: 'hi',
            approx_lat: 42.7,
            approx_lng: 23.3,
            expires_at: now,
            created_at: now,
            view_count: 0,
            reaction_count: 0,
            location_h3_r7: 'cell7',
          },
        ])
        .mockResolvedValueOnce([
          {
            display_name: 'Val',
            avatar_url: null,
            verification_level: 'phone',
          },
        ]);

      redisGet.mockResolvedValueOnce(PUBLIC);

      const card = await service.create(USER, {
        mediaUrl: PUBLIC,
        mediaType: 'image',
        caption: 'hi',
        location: { lat: 42.6977, lng: 23.3219 },
      });

      expect(card.id).toBe('story-1');
      expect(card.authorDisplayName).toBe('Val');
      expect(redisDel).toHaveBeenCalledWith(storyPresignRedisKey(USER));
      expect(emitStoryNew).toHaveBeenCalledWith(
        expect.objectContaining({
          story: expect.objectContaining({ id: 'story-1' }),
          cellId: 'cell7',
        }),
      );
    });

    it('rejects when active story cap is reached', async () => {
      query
        .mockResolvedValueOnce(gateOkUser())
        .mockResolvedValueOnce([{ n: 0 }])
        .mockResolvedValueOnce([{ n: STORY_LIMITS.maxActivePerUser }]);
      redisGet.mockResolvedValueOnce(PUBLIC);
      await expect(
        service.create(USER, {
          mediaUrl: PUBLIC,
          mediaType: 'image',
          location: { lat: 42.7, lng: 23.3 },
        }),
      ).rejects.toBeInstanceOf(BadRequestException);
    });
  });

  describe('remove', () => {
    it('soft-deletes author-owned story', async () => {
      query.mockResolvedValueOnce([{ id: 's1' }]);
      await service.remove(USER, 's1');
      expect(query.mock.calls[0]![0]).toContain('deleted_at = NOW()');
      expect(query.mock.calls[0]![1]).toEqual(['s1', USER]);
    });

    it('throws NotFound when no row updated', async () => {
      query.mockResolvedValueOnce([]);
      await expect(service.remove(USER, 'missing')).rejects.toBeInstanceOf(
        NotFoundException,
      );
    });
  });

  describe('react', () => {
    it('rejects reacting to own story', async () => {
      query.mockResolvedValueOnce([{ author_id: USER }]);
      await expect(service.react(USER, 's1', 'heart')).rejects.toBeInstanceOf(
        BadRequestException,
      );
    });
  });

  describe('listByAuthor', () => {
    it('returns empty when either side has blocked the other', async () => {
      query.mockResolvedValueOnce([{ '?column?': 1 }]);
      const out = await service.listByAuthor(USER, 'other');
      expect(out).toEqual([]);
    });
  });
});
