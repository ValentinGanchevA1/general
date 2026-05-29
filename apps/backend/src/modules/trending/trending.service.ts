import { Inject, Injectable } from '@nestjs/common';
import { InjectDataSource } from '@nestjs/typeorm';
import { DataSource } from 'typeorm';
import * as h3 from 'h3-js';
import type Redis from 'ioredis';

import type { TrendingResponse } from '@g88/shared';

import { REDIS_CLIENT } from '../../config/redis.provider';

const CACHE_TTL_SECONDS = 300;
const MAX_TOPICS = 10;
const H3_RESOLUTION = 7;

@Injectable()
export class TrendingService {
  constructor(
    @Inject(REDIS_CLIENT) private readonly redis: Redis,
    @InjectDataSource() private readonly db: DataSource,
  ) {}

  async nearbyTopics(lat: number, lng: number): Promise<TrendingResponse> {
    const centerCell = h3.latLngToCell(lat, lng, H3_RESOLUTION);
    const cacheKey = `trending:v1:${centerCell}`;

    const cached = await this.redis.get(cacheKey);
    if (cached) return JSON.parse(cached) as TrendingResponse;

    const cells = h3.gridDisk(centerCell, 1);

    const [eventRows, listingRows] = await Promise.all([
      this.db.query<Array<{ title: string }>>(
        `SELECT title
           FROM events
          WHERE location_h3_r7 = ANY($1::text[])
            AND visibility = 'public'
            AND deleted_at IS NULL
            AND starts_at > NOW() - INTERVAL '2 days'
            AND starts_at < NOW() + INTERVAL '7 days'
          LIMIT 50`,
        [cells],
      ),
      this.db.query<Array<{ category: string }>>(
        `SELECT category
           FROM listings
          WHERE location_h3_r7 = ANY($1::text[])
            AND visibility = 'public'
            AND status = 'active'
            AND deleted_at IS NULL
          LIMIT 50`,
        [cells],
      ),
    ]);

    const raw = [
      ...eventRows.map((r) => r.title),
      ...listingRows.map((r) => r.category),
    ];

    const topics = topTopics(raw, MAX_TOPICS);
    const response: TrendingResponse = { topics, generatedAt: new Date().toISOString() };

    await this.redis.set(cacheKey, JSON.stringify(response), 'EX', CACHE_TTL_SECONDS);
    return response;
  }
}

function toHashtag(raw: string): string {
  const slug = raw
    .toLowerCase()
    .trim()
    .slice(0, 30)
    .replace(/[^a-z0-9\s-]/g, '')
    .replace(/\s+/g, '-')
    .replace(/-{2,}/g, '-')
    .replace(/^-|-$/g, '');
  return slug ? `#${slug}` : '';
}

function topTopics(raws: string[], limit: number): string[] {
  const counts = new Map<string, number>();
  for (const raw of raws) {
    const tag = toHashtag(raw);
    if (tag.length > 1) counts.set(tag, (counts.get(tag) ?? 0) + 1);
  }
  return [...counts.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, limit)
    .map(([tag]) => tag);
}
