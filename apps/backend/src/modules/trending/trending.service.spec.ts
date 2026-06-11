import { Test } from '@nestjs/testing';
import { DataSource } from 'typeorm';
import { getDataSourceToken } from '@nestjs/typeorm';

import { TrendingService } from './trending.service';
import { REDIS_CLIENT } from '../../config/redis.provider';

describe('TrendingService', () => {
  let service: TrendingService;
  let query: jest.Mock;
  let redisGet: jest.Mock;
  let redisSet: jest.Mock;

  beforeEach(async () => {
    query = jest.fn().mockResolvedValue([]);
    redisGet = jest.fn().mockResolvedValue(null);
    redisSet = jest.fn().mockResolvedValue('OK');
    const mod = await Test.createTestingModule({
      providers: [
        TrendingService,
        { provide: getDataSourceToken(), useValue: { query } as unknown as DataSource },
        { provide: REDIS_CLIENT, useValue: { get: redisGet, set: redisSet } },
      ],
    }).compile();
    service = mod.get(TrendingService);
  });

  it('serves a cache hit without touching Postgres', async () => {
    const cached = { topics: ['#cached'], generatedAt: '2026-06-10T00:00:00Z' };
    redisGet.mockResolvedValue(JSON.stringify(cached));

    await expect(service.nearbyTopics(1, 1)).resolves.toEqual(cached);
    expect(query).not.toHaveBeenCalled();
  });

  it('aggregates events + listings into ranked hashtags and caches the result', async () => {
    // events query (titles), then listings query (categories)
    query
      .mockResolvedValueOnce([{ title: 'Live Music' }, { title: 'Live Music' }, { title: 'Yoga' }])
      .mockResolvedValueOnce([{ category: 'Yoga' }]);

    const res = await service.nearbyTopics(1, 1);

    // "Live Music" x2 + "Yoga" x2 -> both present, music/yoga slugified, sorted by count
    expect(res.topics).toContain('#live-music');
    expect(res.topics).toContain('#yoga');
    expect(res.topics[0]).toBe('#live-music'); // would tie at 2; insertion order keeps music first
    expect(redisSet).toHaveBeenCalledWith(
      expect.stringContaining('trending:v1:'),
      expect.any(String),
      'EX',
      300,
    );
  });
});
