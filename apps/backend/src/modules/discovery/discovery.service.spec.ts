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

  describe('block isolation', () => {
    const expectAuthorBlockPredicate = (sql: string): void => {
      expect(sql).toContain("WHEN 'user' THEN v_discoverable_entity.id");
      expect(sql).toContain(
        "WHEN 'event' THEN NULLIF(v_discoverable_entity.meta->>'hostId', '')::uuid",
      );
      expect(sql).toContain(
        "WHEN 'listing' THEN NULLIF(v_discoverable_entity.meta->>'sellerId', '')::uuid",
      );
      expect(sql).toContain('ub.blocker_id = $3');
      expect(sql).toContain('ub.blocked_id = $3');
    };

    it('applies bilateral block filtering to users, event hosts and listing sellers at entity zoom', async () => {
      await call();

      const [sql, params] = query.mock.calls[0] as [string, unknown[]];
      expectAuthorBlockPredicate(sql);
      expect(params[2]).toBe('me');
    });

    it('applies the same author block filtering before cluster counts are computed', async () => {
      (isEntityZoom as jest.Mock).mockReturnValue(false);

      await call();

      const [sql, params] = query.mock.calls[0] as [string, unknown[]];
      expectAuthorBlockPredicate(sql);
      expect(sql).toContain('GROUP BY');
      expect(params[2]).toBe('me');
    });
  });

  describe('snapshot isolation', () => {
    it('namespaces Redis snapshots by requester even when viewport hashes match', async () => {
      const first = await call({ requesterId: 'viewer-a' });
      const second = await call({ requesterId: 'viewer-b' });

      expect(first.viewportHash).toBe(second.viewportHash);
      const firstKey = redisSet.mock.calls[0]?.[0] as string;
      const secondKey = redisSet.mock.calls[1]?.[0] as string;
      expect(firstKey).toBe(`discovery:snap:viewer-a:${first.viewportHash}`);
      expect(secondKey).toBe(`discovery:snap:viewer-b:${second.viewportHash}`);
      expect(firstKey).not.toBe(secondKey);
    });

    it('reads a previous diff snapshot only from the current requester namespace', async () => {
      await call({ requesterId: 'viewer-a', prevViewportHash: 'previous-hash' });

      expect(redisGet).toHaveBeenCalledWith('discovery:snap:viewer-a:previous-hash');
    });
  });

  describe('marketplace kind filtering', () => {
    it('filters entity results to sell-side listings of the requested first-class kind', async () => {
      await call({ kinds: ['listing'], marketplaceKind: 'job' });

      const [sql] = query.mock.calls[0] as [string, unknown[]];
      expect(sql).toContain("COALESCE(meta->>'mode', 'sell') = 'sell'");
      expect(sql).toContain("COALESCE(meta->>'marketplaceKind', 'for_sale') = 'job'");
    });

    it('applies the marketplace kind filter before cluster counts are computed', async () => {
      (isEntityZoom as jest.Mock).mockReturnValue(false);

      await call({ kinds: ['listing'], marketplaceKind: 'local_deal' });

      const [sql] = query.mock.calls[0] as [string, unknown[]];
      expect(sql).toContain("COALESCE(meta->>'mode', 'sell') = 'sell'");
      expect(sql).toContain("COALESCE(meta->>'marketplaceKind', 'for_sale') = 'local_deal'");
      expect(sql).toContain('GROUP BY');
    });

    it('keeps Wanted authoritative and ignores a stale sell-side marketplace kind', async () => {
      await call({ kinds: ['listing'], listingMode: 'buy', marketplaceKind: 'service' });

      const [sql] = query.mock.calls[0] as [string, unknown[]];
      expect(sql).toContain("meta->>'mode' = 'buy'");
      expect(sql).not.toContain('marketplaceKind');
    });

    it('uses marketplace kind in the viewport hash so diff snapshots cannot cross filter state', async () => {
      const jobs = await call({ kinds: ['listing'], marketplaceKind: 'job' });
      const services = await call({ kinds: ['listing'], marketplaceKind: 'service' });

      expect(jobs.viewportHash).not.toBe(services.viewportHash);
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
