import { Test } from '@nestjs/testing';
import { DataSource } from 'typeorm';
import { getDataSourceToken } from '@nestjs/typeorm';

const shared = jest.requireActual('@g88/shared');
jest.mock('@g88/shared', () => ({
  ...shared,
  h3ResolutionForZoom: jest.fn(),
  isEntityZoom: jest.fn(),
  cellsForViewport: jest.fn(),
}));
jest.mock('h3-js', () => ({ cellToLatLng: jest.fn(() => [1.5, 2.5]) }));

import { h3ResolutionForZoom, isEntityZoom, cellsForViewport } from '@g88/shared';
import type { Viewport } from '@g88/shared';
import { DiscoveryService } from './discovery.service';
import { PresenceService } from '../presence/presence.service';
import { FriendsService } from '../friends/friends.service';
import { REDIS_CLIENT } from '../../config/redis.provider';

const VIEWPORT: Viewport = {
  ne: { lat: 42.72, lng: 23.35 },
  sw: { lat: 42.68, lng: 23.25 },
};

describe('DiscoveryService', () => {
  let service: DiscoveryService;
  let query: jest.Mock;
  let whichAreOnline: jest.Mock;
  let lastSeenMap: jest.Mock;
  let listFriendIds: jest.Mock;
  let listWhoAllowFriendsOnline: jest.Mock;
  let redisGet: jest.Mock;
  let redisSet: jest.Mock;

  beforeEach(async () => {
    query = jest.fn().mockResolvedValue([]);
    whichAreOnline = jest.fn().mockResolvedValue(new Set<string>());
    lastSeenMap = jest.fn().mockResolvedValue(new Map<string, string>());
    listFriendIds = jest.fn().mockResolvedValue([]);
    listWhoAllowFriendsOnline = jest.fn().mockResolvedValue(new Set<string>());
    redisGet = jest.fn().mockResolvedValue(null);
    redisSet = jest.fn().mockResolvedValue('OK');

    (h3ResolutionForZoom as jest.Mock).mockReturnValue(8);
    (isEntityZoom as jest.Mock).mockReturnValue(true);
    (cellsForViewport as jest.Mock).mockReturnValue(['cell1']);

    const mod = await Test.createTestingModule({
      providers: [
        DiscoveryService,
        { provide: getDataSourceToken(), useValue: { query } as unknown as DataSource },
        { provide: PresenceService, useValue: { whichAreOnline, lastSeenMap } },
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

  it('refuses oversize viewport estimate before polygonToCells', async () => {
    (cellsForViewport as jest.Mock).mockReturnValue(
      Array.from({ length: 6000 }, (_, i) => `c${i}`),
    );
    const res = await service.nearby({
      viewport: VIEWPORT,
      zoom: 14,
      requesterId: 'me',
    });
    expect(res.points).toEqual([]);
  });
});
