import { Test } from '@nestjs/testing';
import { getDataSourceToken } from '@nestjs/typeorm';
import type { DataSource } from 'typeorm';

import { REDIS_CLIENT } from '../../config/redis.provider';
import { FriendsService } from '../friends/friends.service';
import { PresenceService } from '../presence/presence.service';
import { DiscoveryService } from './discovery.service';

/** City-scale viewport (~0.05°) so estimateCells stays under the MAX_CELLS guard. */
const VIEWPORT = {
  ne: { lat: 42.72, lng: 23.35 },
  sw: { lat: 42.68, lng: 23.25 },
};

describe('DiscoveryService', () => {
  let service: DiscoveryService;
  let query: jest.Mock;
  let whichAreOnline: jest.Mock;
  let listFriendIds: jest.Mock;
  let listWhoAllowFriendsOnline: jest.Mock;
  let redisGet: jest.Mock;
  let redisSet: jest.Mock;

  beforeEach(async () => {
    query = jest.fn().mockResolvedValue([]);
    whichAreOnline = jest.fn().mockResolvedValue(new Set<string>());
    listFriendIds = jest.fn().mockResolvedValue([]);
    listWhoAllowFriendsOnline = jest.fn().mockResolvedValue(new Set<string>());
    redisGet = jest.fn().mockResolvedValue(null);
    redisSet = jest.fn().mockResolvedValue('OK');

    const mod = await Test.createTestingModule({
      providers: [
        DiscoveryService,
        { provide: getDataSourceToken(), useValue: { query } as unknown as DataSource },
        { provide: PresenceService, useValue: { whichAreOnline } },
        {
          provide: FriendsService,
          useValue: { listFriendIds, listWhoAllowFriendsOnline },
        },
        { provide: REDIS_CLIENT, useValue: { get: redisGet, set: redisSet } },
      ],
    }).compile();
    service = mod.get(DiscoveryService);
  });

  it('returns empty when friendsOnly and no friends', async () => {
    listFriendIds.mockResolvedValueOnce([]);
    const res = await service.nearby({
      viewport: VIEWPORT,
      zoom: 14,
      requesterId: 'me',
      friendsOnly: true,
    });
    expect(res.points).toEqual([]);
    expect(query).not.toHaveBeenCalled();
  });
});
