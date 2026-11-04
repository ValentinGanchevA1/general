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
jest.mock('h3-js', () => ({
  cellToLatLng: jest.fn(() => [1.5, 2.5]),
  cellToParent: jest.fn((cell: string, resolution: number) =>
    `${resolution}:parent-${Math.floor(Number(cell.slice(1)) / 7)}`),
}));

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

  describe('cluster coverage', () => {
    it('retains counts across >500 authorized cells and returns the effective H3 resolution', async () => {
      (isEntityZoom as jest.Mock).mockReturnValue(false);
      const rows = Array.from({ length: 600 }, (_, index) => ({
        cell: `c${index}`, kind: 'user', n: '20',
      }));
      query.mockResolvedValueOnce(rows);

      const res = await call();
      const clusters = asPoints(res.points);
      expect(res.resolution).toBe(7);
      expect(clusters).toHaveLength(86);
      expect(clusters.reduce((total, point) => total + (point.count ?? 0), 0))
        .toBe(12_000);
      expect(clusters.reduce((total, point) => total + (point.by?.user ?? 0), 0))
        .toBe(12_000);
      expect(redisSet).toHaveBeenCalledTimes(1);
      const snapshotJson = redisSet.mock.calls[0]?.[1] as string;
      expect(JSON.parse(snapshotJson)).toHaveLength(86);
      const [sql] = query.mock.calls[0] as [string, unknown[]];
      expect(sql).toContain("visibility = 'public'");
      expect(sql).toContain('NOT EXISTS');
      expect(sql).toContain('GROUP BY');
    });

    it('returns requested H3 resolution when source clusters fit the budget', async () => {
      (isEntityZoom as jest.Mock).mockReturnValue(false);
      query.mockResolvedValueOnce([
        { cell: 'c0', kind: 'event', n: '10' },
        { cell: 'c0', kind: 'listing', n: '5' },
      ]);
      const res = await call();
      expect(res.resolution).toBe(8);
      expect(asPoints(res.points)).toMatchObject([
        { cellId: 'c0', count: 15, by: { event: 10, listing: 5 } },
      ]);
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
      const person = { id: 'u1', kind: 'user', lat: 1.02, lng: 1.02, meta: { ...userMeta } };
      query.mockResolvedValueOnce([person]).mockResolvedValueOnce([person]);
      listFriendIds.mockResolvedValue(['u1']);
      listWhoAllowFriendsOnline.mockResolvedValue(new Set(['u1']));
      whichAreOnline.mockResolvedValue(new Set(['u1']));
      lastSeenMap.mockResolvedValue(
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
      const person = { id: 'u1', kind: 'user', lat: 1.02, lng: 1.02, meta: { ...userMeta } };
      query.mockResolvedValueOnce([person]).mockResolvedValueOnce([person]);
      listFriendIds.mockResolvedValue(['u1']);
      listWhoAllowFriendsOnline.mockResolvedValue(new Set());

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
  describe('global ranking before response cap', () => {
    it('ranks all 10k light candidates and hydrates only the best 500', async () => {
      const candidates = Array.from({ length: 10_000 }, (_, index) => ({
        id: `u-${String(index).padStart(5, '0')}`,
        kind: 'user' as const,
        lat: 2.0,
        lng: 2.0,
        verification: 'none' as const,
        starts_at: null,
        created_at: null,
        listing_mode: undefined,
      }));
      const top = candidates[9_999]!;
      top.lat = 1.025;
      top.lng = 1.025;
      // Verification is part of the lightweight ranking projection.
      const candidateRows = candidates.map((row) =>
        row.id === top.id ? { ...row, verification: 'id' as const } : row,
      );

      query.mockImplementation((sql: string, params: unknown[]) => {
        if (sql.includes('AS listing_mode')) return Promise.resolve(candidateRows);
        const selected = params.find(
          (arg): arg is string[] =>
            Array.isArray(arg) && arg.some((item: unknown) =>
              typeof item === 'string' && item === top.id),
        ) ?? [];
        return Promise.resolve(candidateRows
          .filter((row) => selected.includes(row.id))
          .map((row) => ({
            id: row.id, kind: row.kind, lat: row.lat, lng: row.lng,
            meta: {
              displayName: row.id,
              verification: row.verification,
              online: false,
              lastSeenAt: null,
            },
          })));
      });

      const response = await call({ rankBy: 'relevance' });
      const points = asPoints(response.points);
      expect(points).toHaveLength(500);
      expect(points.some((point) => point.id === top.id)).toBe(true);
      expect(query).toHaveBeenCalledTimes(2);
      const [candidateSql] = query.mock.calls[0] as [string, unknown[]];
      const [hydrateSql, hydrateParams] = query.mock.calls[1] as [string, unknown[]];
      expect(candidateSql).not.toContain('LIMIT');
      expect(candidateSql).not.toContain('SELECT id, kind,\n             ST_Y');
      expect(hydrateSql).toContain('LIMIT');
      expect(hydrateSql).toContain("visibility = 'public'");
      expect(hydrateSql).toContain('NOT EXISTS');
      const selectedKeys = hydrateParams.find(
        (arg): arg is string[] => Array.isArray(arg) && arg.includes(top.id),
      ) ?? [];
      expect(selectedKeys).toHaveLength(500);
    });

    it('excludes incompatible dating candidates before relevance top-K', async () => {
      const candidates = Array.from({ length: 650 }, (_, index) => ({
        id: `u-${index}`,
        kind: 'user' as const,
        lat: 1.025,
        lng: 1.025,
        verification: 'id' as const,
      }));
      candidates.push({
        id: 'compatible', kind: 'user', lat: 2, lng: 2, verification: 'id',
      });
      query.mockImplementation((sql: string, params: unknown[]) => {
        if (sql.includes('SELECT COALESCE(open_to_dating')) {
          return Promise.resolve([{ open_to_dating: true }]);
        }
        if (sql.includes('AS listing_mode')) return Promise.resolve(candidates);
        if (sql.includes('SELECT id, gender')) {
          const ids = params[0] as string[];
          return Promise.resolve([
            { id: 'me', gender: 'male', seeking_genders: ['female'] },
            ...ids.map((id) => ({
              id,
              gender: id === 'compatible' ? 'female' : 'male',
              seeking_genders: ['male'],
            })),
          ]);
        }
        const keys = params.find((arg): arg is string[] =>
          Array.isArray(arg) && arg.includes('compatible')) ?? [];
        return Promise.resolve(candidates
          .filter((person) => keys.includes(person.id))
          .map((person) => ({
            ...person,
            meta: { displayName: person.id, verification: 'id' },
          })));
      });
      const result = await call({ datingOnly: true });
      expect(asPoints(result.points).map((point) => point.id)).toEqual(['compatible']);
    });

    // A UUID belongs to its entity kind: user and event IDs can collide in the UNION view.
    it('preserves canonical entity kind when a user and event share a UUID', async () => {
      const sharedId = '00000000-0000-4000-8000-000000000001';
      const users = Array.from({ length: 520 }, (_, index) => ({
        id: index === 0
          ? sharedId
          : `00000000-0000-4000-8000-${String(index + 1).padStart(12, '0')}`,
        kind: 'user' as const,
        lat: 1.025,
        lng: 1.025,
        verification: 'id' as const,
        starts_at: null,
        created_at: null,
        listing_mode: undefined,
      }));
      const event = {
        id: sharedId,
        kind: 'event' as const,
        lat: 1.025,
        lng: 1.025,
        verification: null,
        starts_at: '2100-01-01T00:00:00.000Z',
        created_at: null,
        listing_mode: undefined,
      };
      const candidates = [...users, event];
      query.mockImplementation((sql: string, params: unknown[]) => {
        if (sql.includes('AS listing_mode')) return Promise.resolve(candidates);
        const selectedUuids = params[3] as string[];
        const userIds = params[4] as string[];
        const eventIds = params[5] as string[];
        return Promise.resolve(candidates
          .filter((row) =>
            selectedUuids.includes(row.id) &&
            (row.kind === 'user' ? userIds.includes(row.id) : eventIds.includes(row.id)),
          )
          .slice(0, 500)
          .map((row) => ({
            id: row.id, kind: row.kind, lat: row.lat, lng: row.lng,
            meta: row.kind === 'user'
              ? { displayName: row.id, verification: 'id' }
              : { startsAt: event.starts_at, title: 'Unselected event' },
          })));
      });
      const response = await call({ rankBy: 'relevance' });
      expect(response.points).toHaveLength(500);
      expect(response.points.some((point) =>
        point.kind === 'user' && point.id === sharedId)).toBe(true);
      expect(response.points.some((point) =>
        point.kind === 'event' && point.id === sharedId)).toBe(false);
      const [sql, params] = query.mock.calls[1] as [string, unknown[]];
      expect(sql).toContain('AND id = ANY($4::uuid[])');
      expect(sql).toContain("kind = 'user' AND id = ANY($5::uuid[])");
      expect(sql).toContain("kind = 'event' AND id = ANY($6::uuid[])");
      expect(sql).toContain("kind = 'listing' AND id = ANY($7::uuid[])");
      expect(params[4]).toContain(sharedId);
      expect(params[5]).not.toContain(sharedId);
    });

    it('orders newest in SQL before applying the hard LIMIT', async () => {
      const latest = {
        id: 'event-new',
        kind: 'event',
        lat: 1.025,
        lng: 1.025,
        meta: { title: 'New event', startsAt: '2026-11-05T12:00:00.000Z' },
      };
      query.mockResolvedValueOnce([latest]);
      const response = await call({ rankBy: 'newest', kinds: ['event', 'listing'] });
      expect(asPoints(response.points)[0]?.id).toBe('event-new');
      expect(query).toHaveBeenCalledTimes(1);
      const [sql] = query.mock.calls[0] as [string, unknown[]];
      expect(sql).toContain("WHEN kind = 'event' THEN (meta->>'startsAt')::timestamptz");
      expect(sql).toContain("WHEN kind = 'listing' THEN (meta->>'createdAt')::timestamptz");
      expect(sql).toContain('DESC NULLS LAST');
      expect(sql.indexOf('ORDER BY')).toBeLessThan(sql.indexOf('LIMIT'));
    });
  });

});
