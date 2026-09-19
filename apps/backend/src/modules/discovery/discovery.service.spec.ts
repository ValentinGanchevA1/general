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
  ne: { lat: 1.05, lng: 1.05 },
  sw: { lat: 1.0, lng: 1.0 },
};

type LoosePoint = {
  kind: string;
  id?: string;
  cellId?: string;
  count?: number;
  by?: Record<string, number>;
  meta?: Record<string, unknown>;
  rankScore?: number;
};
const asPoints = (ps: unknown): LoosePoint[] => ps as LoosePoint[];

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
    (h3ResolutionForZoom as jest.Mock).mockReturnValue(8);
    (isEntityZoom as jest.Mock).mockReturnValue(true);
    (cellsForViewport as jest.Mock).mockReturnValue(['c1']);

    query = jest.fn().mockResolvedValue([]);
    whichAreOnline = jest.fn().mockResolvedValue(new Set<string>());
    lastSeenMap = jest.fn().mockResolvedValue(new Map<string, string>());
    listFriendIds = jest.fn().mockResolvedValue([]);
    listWhoAllowFriendsOnline = jest.fn().mockResolvedValue(new Set<string>());
    redisGet = jest.fn().mockResolvedValue(null);
    redisSet = jest.fn().mockResolvedValue('OK');

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

  const call = (over: Record<string, unknown> = {}) =>
    service.nearby({ viewport: VIEWPORT, zoom: 16, requesterId: 'me', ...over });

  describe('guards', () => {
    it('returns empty (no DB hit) when the viewport produces no cells', async () => {
      (cellsForViewport as jest.Mock).mockReturnValue([]);
      const res = await call();
      expect(res.points).toEqual([]);
      expect(query).not.toHaveBeenCalled();
    });

    it('returns empty when friendsOnly and no friends', async () => {
      listFriendIds.mockResolvedValueOnce([]);
      const res = await call({ friendsOnly: true });
      expect(res.points).toEqual([]);
      expect(query).not.toHaveBeenCalled();
    });

    it('refuses oversize viewport before polygonToCells', async () => {
      (cellsForViewport as jest.Mock).mockReturnValue(
        Array.from({ length: 6000 }, (_, i) => `c${i}`),
      );
      const res = await call();
      expect(res.points).toEqual([]);
    });
  });

  describe('presence enrichment', () => {
    const userMeta = {
      displayName: 'A',
      avatarUrl: null,
      verification: 'email',
      online: false,
      lastSeenAt: null,
    };

    it('sets online + lastSeenAt for friends who allow presence', async () => {
      query.mockResolvedValueOnce([
        { id: 'u1', kind: 'user', lat: 1.02, lng: 1.02, meta: { ...userMeta } },
      ]);
      listFriendIds.mockResolvedValueOnce(['u1']);
      listWhoAllowFriendsOnline.mockResolvedValueOnce(new Set(['u1']));
      whichAreOnline.mockResolvedValueOnce(new Set(['u1']));
      lastSeenMap.mockResolvedValueOnce(
        new Map([['u1', '2026-09-19T12:00:00.000Z']]),
      );

      const res = await call();
      const pts = asPoints(res.points);
      expect(pts).toHaveLength(1);
      expect(pts[0]!.meta).toMatchObject({
        online: true,
        isFriend: true,
        lastSeenAt: '2026-09-19T12:00:00.000Z',
      });
      expect(lastSeenMap).toHaveBeenCalledWith(['u1']);
    });

    it('hides online and lastSeen when friend disallows friends_see_online_status', async () => {
      query.mockResolvedValueOnce([
        { id: 'u1', kind: 'user', lat: 1.02, lng: 1.02, meta: { ...userMeta } },
      ]);
      listFriendIds.mockResolvedValueOnce(['u1']);
      listWhoAllowFriendsOnline.mockResolvedValueOnce(new Set());

      const res = await call();
      const pts = asPoints(res.points);
      expect(pts[0]!.meta).toMatchObject({
        online: false,
        isFriend: true,
        lastSeenAt: null,
      });
      expect(whichAreOnline).not.toHaveBeenCalled();
      expect(lastSeenMap).not.toHaveBeenCalled();
    });
  });
});
