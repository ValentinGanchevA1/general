import { BadRequestException } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { getDataSourceToken } from '@nestjs/typeorm';
import type { DataSource } from 'typeorm';

import { FriendsListMetaService } from './friends-list-meta.service';

describe('FriendsListMetaService', () => {
  let service: FriendsListMetaService;
  let query: jest.Mock;

  const VIEWER = '11111111-1111-4111-8111-111111111111';
  const PEER = '22222222-2222-4222-8222-222222222222';

  beforeEach(async () => {
    query = jest.fn().mockResolvedValue([]);
    const module = await Test.createTestingModule({
      providers: [
        FriendsListMetaService,
        {
          provide: getDataSourceToken(),
          useValue: { query } as unknown as DataSource,
        },
      ],
    }).compile();
    service = module.get(FriendsListMetaService);
  });

  it('returns an empty response without hitting the database when no ids are supplied', async () => {
    await expect(service.getListMeta(VIEWER, '')).resolves.toEqual({ items: [] });
    expect(query).not.toHaveBeenCalled();
  });

  it('rejects malformed ids before the database query', async () => {
    await expect(service.getListMeta(VIEWER, 'not-a-uuid')).rejects.toBeInstanceOf(
      BadRequestException,
    );
    expect(query).not.toHaveBeenCalled();
  });

  it('rejects requests larger than the batch cap', async () => {
    const ids = Array.from({ length: 101 }, (_, index) =>
      `aaaaaaaa-aaaa-4aaa-8aaa-${String(index).padStart(12, '0')}`,
    ).join(',');

    await expect(service.getListMeta(VIEWER, ids)).rejects.toBeInstanceOf(BadRequestException);
    expect(query).not.toHaveBeenCalled();
  });

  it('returns mutual counts and kilometer-rounded distance for eligible social peers', async () => {
    query.mockResolvedValueOnce([
      {
        user_id: PEER,
        mutual_count: '3',
        distance_m: '1432',
      },
    ]);

    await expect(service.getListMeta(VIEWER, `${PEER},${PEER}`)).resolves.toEqual({
      items: [
        {
          userId: PEER,
          mutualFriendsCount: 3,
          distanceMeters: 1000,
        },
      ],
    });

    expect(query).toHaveBeenCalledTimes(1);
    expect(query.mock.calls[0]![0]).toContain('FROM user_blocks');
    expect(query.mock.calls[0]![0]).toContain('FROM follows');
    expect(query.mock.calls[0]![0]).toContain('ST_Distance');
    expect(query.mock.calls[0]![1]).toEqual([VIEWER, [PEER]]);
  });

  it('preserves missing location as null', async () => {
    query.mockResolvedValueOnce([
      {
        user_id: PEER,
        mutual_count: 0,
        distance_m: null,
      },
    ]);

    await expect(service.getListMeta(VIEWER, PEER)).resolves.toEqual({
      items: [
        {
          userId: PEER,
          mutualFriendsCount: 0,
          distanceMeters: null,
        },
      ],
    });
  });
});
