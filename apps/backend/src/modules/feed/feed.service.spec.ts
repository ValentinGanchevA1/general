// apps/backend/src/modules/feed/feed.service.spec.ts
import { Test } from '@nestjs/testing';
import { DataSource } from 'typeorm';
import { getDataSourceToken } from '@nestjs/typeorm';

import { FeedService } from './feed.service';

describe('FeedService', () => {
  let service: FeedService;
  let query: jest.Mock;

  beforeEach(async () => {
    // Default any unstubbed query (e.g. selectAlerts' location lookup, plus
    // future feed sources) to an empty result; tests override call-by-call
    // with mockResolvedValueOnce where they assert specific rows.
    query = jest.fn().mockResolvedValue([]);
    const dsMock = { query } as unknown as DataSource;

    const mod = await Test.createTestingModule({
      providers: [
        FeedService,
        { provide: getDataSourceToken(), useValue: dsMock },
      ],
    }).compile();
    service = mod.get(FeedService);
  });

  it('merges chats + waves sorted newest first', async () => {
    query
      .mockResolvedValueOnce([
        {
          id: 'chat:c1', conversation_id: 'c1',
          actor_id: 'u1', actor_name: 'Alice',
          preview: 'hi',
          created_at: new Date('2026-05-22T10:00:00Z'),
          unread: true,
        },
      ])
      .mockResolvedValueOnce([
        {
          id: 'wave:w1', conversation_id: null,
          actor_id: 'u2', actor_name: 'Bob',
          created_at: new Date('2026-05-22T11:00:00Z'),
          unread: true,
        },
      ]);

    const res = await service.aggregate('me', new Date('2026-05-15'), [], 50);

    expect(res.items).toHaveLength(2);
    expect(res.items[0]!.type).toBe('wave');
    expect(res.items[1]!.type).toBe('chat');
  });

  it('respects type filter (waves only)', async () => {
    query.mockResolvedValueOnce([]);
    await service.aggregate('me', new Date(), ['wave'], 50);
    expect(query).toHaveBeenCalledTimes(1);
  });

  it('returns valid nextSince when empty', async () => {
    query.mockResolvedValueOnce([]).mockResolvedValueOnce([]);
    const res = await service.aggregate('me', new Date(), [], 50);
    expect(res.items).toHaveLength(0);
    expect(Date.parse(res.nextSince)).not.toBeNaN();
  });
});
