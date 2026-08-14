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
import { StoriesService } from './stories.service';

describe('StoriesService', () => {
  let service: StoriesService;
  let query: jest.Mock;
  let redisSet: jest.Mock;
  let redisGet: jest.Mock;
  let redisDel: jest.Mock;
  let storyPresignedUrl: jest.Mock;
  let emitStoryNew: jest.Mock;

  const USER = 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa';
  const PUBLIC_URL =
    'https://g88-uploads-dev.s3.eu-north-1.amazonaws.com/stories/' +
    USER +
    '/media-uuid.jpg';
  const EXTERNAL_URL = 'https://evil.example/pic.jpg';
  const OTHER_USER_URL =
    'https://g88-uploads-dev.s3.eu-north-1.amazonaws.com/stories/bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb/x.jpg';

  const phoneUser = {
    verification_level: 'phone' as const,
    created_at: new Date('2026-01-01T00:00:00Z'),
  };
  const emailOldUser = {
    verification_level: 'email' as const,
    created_at: new Date(Date.now() - 48 * 3600_000),
  };
  const emailNewUser = {
    verification_level: 'email' as const,
    created_at: new Date(Date.now() - 60 * 60_000),
  };
  const noneUser = {
    verification_level: 'none' as const,
    created_at: new Date('2026-01-01T00:00:00Z'),
  };

  beforeEach(async () => {
    query = jest.fn().mockResolvedValue([]);
    redisSet = jest.fn().mockResolvedValue('OK');
    redisGet = jest.fn().mockResolvedValue(null);
    redisDel = jest.fn().mockResolvedValue(1);
    storyPresignedUrl = jest.fn().mockResolvedValue({
      uploadUrl: 'https://s3.example/put',
      publicUrl: PUBLIC_URL,
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
          useValue: { set: redisSet, get: redisGet, del: redisDel },
        },
      ],
    }).compile();
    service = mod.get(StoriesService);
  });

  describe('assertCanPost / presign gate', () => {
    it('rejects email_unverified before S3', async () => {
      query.mockResolvedValueOnce([noneUser]);
      await expect(
        service.presign(USER, { contentType: 'image/jpeg' }),
      ).rejects.toBeInstanceOf(ForbiddenException);
      expect(storyPresignedUrl).not.toHaveBeenCalled();
      expect(redisSet).not.toHaveBeenCalled();
    });

    it('rejects account_too_new for email-only under 24h', async () => {
      query.mockResolvedValueOnce([emailNewUser]);
      await expect(
        service.presign(USER, { contentType: 'image/jpeg' }),
      ).rejects.toMatchObject({
        response: expect.objectContaining({ code: 'story.account_too_new' }),
      });
      expect(storyPresignedUrl).not.toHaveBeenCalled();
    });

    it('rejects rate limit for email-only at softerGateMaxPer24h', async () => {
      query
        .mockResolvedValueOnce([emailOldUser])
        .mockResolvedValueOnce([{ n: STORY_LIMITS.softerGateMaxPer24h }]);
      await expect(
        service.presign(USER, { contentType: 'image/jpeg' }),
      ).rejects.toBeInstanceOf(HttpException);
      expect(storyPresignedUrl).not.toHaveBeenCalled();
    });

    it('phone+ skips age and stores Redis presign token', async () => {
      query
        .mockResolvedValueOnce([phoneUser])
        .mockResolvedValueOnce([{ n: 0 }]);
      const res = await service.presign(USER, { contentType: 'image/jpeg' });
      expect(res.publicUrl).toBe(PUBLIC_URL);
      expect(storyPresignedUrl).toHaveBeenCalledWith(USER, 'image/jpeg');
      expect(redisSet).toHaveBeenCalledWith(
        expect.stringMatching(new RegExp(`^story:presign:${USER}:`)),
        PUBLIC_URL,
        'EX',
        300,
      );
    });
  });

  describe('create — mediaUrl trust', () => {
    const dto = {
      mediaUrl: PUBLIC_URL,
      mediaType: 'image' as const,
      location: { lat: 42.7, lng: 23.3 },
    };

    function mockGateOk() {
      query
        .mockResolvedValueOnce([phoneUser])
        .mockResolvedValueOnce([{ n: 0 }]);
    }

    it('rejects external mediaUrl (wrong host/path)', async () => {
      mockGateOk();
      await expect(
        service.create(USER, { ...dto, mediaUrl: EXTERNAL_URL }),
      ).rejects.toMatchObject({
        response: expect.objectContaining({ code: 'story.media_url_untrusted' }),
      });
      expect(redisGet).not.toHaveBeenCalled();
    });

    it('rejects stories path owned by another user', async () => {
      mockGateOk();
      await expect(
        service.create(USER, { ...dto, mediaUrl: OTHER_USER_URL }),
      ).rejects.toMatchObject({
        response: expect.objectContaining({ code: 'story.media_url_untrusted' }),
      });
    });

    it('rejects valid path without live Redis presign token', async () => {
      mockGateOk();
      redisGet.mockResolvedValueOnce(null);
      await expect(service.create(USER, dto)).rejects.toMatchObject({
        response: expect.objectContaining({ code: 'story.media_url_untrusted' }),
      });
      expect(redisGet).toHaveBeenCalled();
      expect(redisDel).not.toHaveBeenCalled();
    });

    it('rejects malformed mediaUrl', async () => {
      mockGateOk();
      await expect(
        service.create(USER, { ...dto, mediaUrl: 'not-a-url' }),
      ).rejects.toBeInstanceOf(BadRequestException);
    });

    it('accepts bound publicUrl and consumes Redis token before insert', async () => {
      mockGateOk();
      redisGet.mockResolvedValueOnce(PUBLIC_URL);
      query
        .mockResolvedValueOnce([{ n: 0 }])
        .mockResolvedValueOnce([
          {
            id: 'story-1',
            author_id: USER,
            media_url: PUBLIC_URL,
            media_type: 'image',
            caption: null,
            approx_lat: 42.7,
            approx_lng: 23.3,
            expires_at: new Date('2026-08-15T00:00:00Z'),
            created_at: new Date('2026-08-14T00:00:00Z'),
            view_count: 0,
            reaction_count: 0,
            location_h3_r7: 'cell7',
          },
        ])
        .mockResolvedValueOnce([
          {
            display_name: 'Me',
            avatar_url: null,
            verification_level: 'phone',
          },
        ]);

      const card = await service.create(USER, dto);

      expect(redisDel).toHaveBeenCalled();
      expect(card.id).toBe('story-1');
      expect(emitStoryNew).toHaveBeenCalledWith(
        expect.objectContaining({
          story: expect.objectContaining({ id: 'story-1' }),
        }),
      );
    });
  });

  describe('react / remove guards', () => {
    it('rejects self-react', async () => {
      query.mockResolvedValueOnce([{ author_id: USER }]);
      await expect(service.react(USER, 's1', 'heart')).rejects.toBeInstanceOf(
        BadRequestException,
      );
    });

    it('remove returns not found when no row updated', async () => {
      query.mockResolvedValueOnce([]);
      await expect(service.remove(USER, 's1')).rejects.toBeInstanceOf(NotFoundException);
    });
  });
});
