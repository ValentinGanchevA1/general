import { Test } from '@nestjs/testing';
import { DataSource } from 'typeorm';
import { getDataSourceToken } from '@nestjs/typeorm';

// Mock the pure geo helpers so we can drive resolution / cell set / zoom branch
// deterministically; everything else from @g88/shared stays real (types, etc.).
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

// City-scale (~5.5 km): estimateCellCount at r8 stays well under
// MAX_CELLS_PER_VIEWPORT * ESTIMATE_CELL_MARGIN (4000). A 1°×1° box
// estimates ~16k cells and is refused before cellsForViewport / DB.
const VIEWPORT: Viewport = {
  ne: { lat: 1.05, lng: 1.05 },
  sw: { lat: 1.0, lng: 1.0 },
};

// Structural view over the DiscoveryPoint union for assertions (cluster vs entity).
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

  const call = (over: Record<string, unknown> = {}) =>
    service.nearby({ viewport: VIEWPORT, zoom: 16, requesterId: 'me', ...over });

  describe('guards', () => {
    it('returns empty (no DB hit) when the viewport produces no cells', async () => {
      (cellsForViewport as jest.Mock).mockReturnValue([]);
      const res = await call();
      expect(res.points).toEqual([]);
      expect(res.resolution).toBe(8);
      expect(query).not.toHaveBeenCalled();
    });

    it('refuses a runaway viewport (>5000 cells) without querying', async () => {
      (cellsForViewport as jest.Mock).mockReturnValue(new Array(5001).fill('c'));
      const res = await call();
      expect(res.points).toEqual([]);
      expect(query).not.toHaveBeenCalled();
    });

    it('refuses before polygonToCells when area estimate exceeds soft cap', async () => {
      (cellsForViewport as jest.Mock).mockClear();
      const huge: Viewport = { ne: { lat: 50, lng: 30 }, sw: { lat: 0, lng: 0 } };
      const res = await call({ viewport: huge });
      expect(res.points).toEqual([]);
      expect(query).not.toHaveBeenCalled();
      expect(cellsForViewport).not.toHaveBeenCalled();
    });

    it('does not refuse a narrow antimeridian-crossing viewport (normalized lng delta)', async () => {
      const antimeridian: Viewport = {
        ne: { lat: 1.05, lng: -179 },
        sw: { lat: 1.0, lng: 179 },
      };
      await call({ viewport: antimeridian });
      expect(query).toHaveBeenCalled();
    });

    it('still refuses a genuinely wide antimeridian-crossing viewport', async () => {
      const wide: Viewport = { ne: { lat: 2, lng: -1 }, sw: { lat: 1, lng: 179 } };
      const res = await call({ viewport: wide });
      expect(res.points).toEqual([]);
      expect(query).not.toHaveBeenCalled();
    });

    it('defaults to all kinds and excludes the requester / private rows', async () => {
      await call();
      const [, params] = query.mock.calls[0]!;
      expect(params[1]).toEqual(['user', 'event', 'listing']);
      expect(params[2]).toBe('me');
      expect(query.mock.calls[0]![0]).toContain("visibility = 'public'");
    });
  });

  describe('entity zoom — individual points + presence overlay', () => {
    beforeEach(() => (isEntityZoom as jest.Mock).mockReturnValue(true));

    const userMeta = { displayName: 'A', avatarUrl: null, verification: 'email', online: false, lastSeenAt: null };

    it('overlays live Redis presence onto friend pins only when peer allows friends online', async () => {
      query.mockResolvedValueOnce([
        { id: 'u1', kind: 'user', lat: 10, lng: 20, meta: { ...userMeta } },
        { id: 'e1', kind: 'event', lat: 11, lng: 21, meta: { title: 'Party' } },
      ]);
      whichAreOnline.mockResolvedValue(new Set(['u1']));
      listFriendIds.mockResolvedValue(['u1']);
      listWhoAllowFriendsOnline.mockResolvedValue(new Set(['u1']));

      const res = await call();

      expect(listFriendIds).toHaveBeenCalledWith('me');
      expect(listWhoAllowFriendsOnline).toHaveBeenCalledWith(['u1']);
      expect(whichAreOnline).toHaveBeenCalledWith(['u1']);
      const points = asPoints(res.points);
      const user = points.find((p) => p.kind === 'user');
      const event = points.find((p) => p.kind === 'event');
      expect(user?.meta?.online).toBe(true);
      expect(user?.meta?.isFriend).toBe(true);
      expect(event?.meta).toEqual({ title: 'Party' });
    });

    it('hides online for non-friends even if presence is hot', async () => {
      query.mockResolvedValueOnce([
        { id: 'u1', kind: 'user', lat: 10, lng: 20, meta: { ...userMeta } },
      ]);
      whichAreOnline.mockResolvedValue(new Set(['u1']));
      listFriendIds.mockResolvedValue([]);
      listWhoAllowFriendsOnline.mockResolvedValue(new Set());

      const res = await call();
      const user = asPoints(res.points).find((p) => p.kind === 'user');
      expect(user?.meta?.online).toBe(false);
      expect(user?.meta?.isFriend).toBe(false);
      expect(whichAreOnline).not.toHaveBeenCalled();
    });

    it('hides online when friend disallows friends_see_online_status', async () => {
      query.mockResolvedValueOnce([
        { id: 'u1', kind: 'user', lat: 10, lng: 20, meta: { ...userMeta } },
      ]);
      whichAreOnline.mockResolvedValue(new Set(['u1']));
      listFriendIds.mockResolvedValue(['u1']);
      listWhoAllowFriendsOnline.mockResolvedValue(new Set());

      const res = await call();
      const user = asPoints(res.points).find((p) => p.kind === 'user');
      expect(user?.meta?.online).toBe(false);
      expect(user?.meta?.isFriend).toBe(true);
      expect(whichAreOnline).not.toHaveBeenCalled();
    });

    it('does not call presence when there are no user rows', async () => {
      query.mockResolvedValueOnce([{ id: 'e1', kind: 'event', lat: 11, lng: 21, meta: {} }]);
      await call();
      expect(whichAreOnline).not.toHaveBeenCalled();
      expect(listFriendIds).not.toHaveBeenCalled();
    });
  });

  describe('relevance ranking', () => {
    beforeEach(() => (isEntityZoom as jest.Mock).mockReturnValue(true));

    it('orders friend ID-verified online near viewer above stranger far away', async () => {
      query.mockResolvedValueOnce([
        {
          id: 'stranger',
          kind: 'user',
          lat: 1.04,
          lng: 1.04,
          meta: {
            displayName: 'Far',
            avatarUrl: null,
            verification: 'none',
            online: false,
            lastSeenAt: null,
          },
        },
        {
          id: 'buddy',
          kind: 'user',
          lat: 1.025,
          lng: 1.025,
          meta: {
            displayName: 'Buddy',
            avatarUrl: null,
            verification: 'id',
            online: false,
            lastSeenAt: null,
          },
        },
      ]);
      listFriendIds.mockResolvedValue(['buddy']);
      listWhoAllowFriendsOnline.mockResolvedValue(new Set(['buddy']));
      whichAreOnline.mockResolvedValue(new Set(['buddy']));

      const res = await call({ rankBy: 'relevance' });
      const points = asPoints(res.points).filter((p) => p.kind === 'user');
      expect(points.map((p) => p.id)).toEqual(['buddy', 'stranger']);
      expect(typeof points[0]?.rankScore).toBe('number');
      expect((points[0]?.rankScore as number) > (points[1]?.rankScore as number)).toBe(true);
    });
  });

  describe('topic filter (P3.6)', () => {
    it('restricts kinds to event/listing, slugifies, and binds the normalized topic', async () => {
      await call({ topic: '#Open-Mic' });
      const [sql, params] = query.mock.calls[0]!;
      expect(params[1]).toEqual(['event', 'listing']);
      expect(sql).toContain('g88_slugify');
      expect(params).toContain('open-mic');
    });

    it('does not add the slug clause when no topic is given', async () => {
      await call();
      expect(query.mock.calls[0]![0]).not.toContain('g88_slugify');
    });

    it('returns empty without querying when topic is set but kinds exclude event/listing', async () => {
      const res = await call({ topic: '#yoga', kinds: ['user'] });
      expect(res.points).toEqual([]);
      expect(query).not.toHaveBeenCalled();
    });
  });

  describe('cluster zoom — per-cell rollup', () => {
    beforeEach(() => (isEntityZoom as jest.Mock).mockReturnValue(false));

    it('rolls up counts per cell with a by-kind breakdown', async () => {
      query.mockResolvedValueOnce([
        { cell: 'c1', kind: 'user', n: '3' },
        { cell: 'c1', kind: 'event', n: '2' },
        { cell: 'c2', kind: 'user', n: '1' },
      ]);

      const res = await call({ zoom: 8 });

      const points = asPoints(res.points);
      const c1 = points.find((p) => p.cellId === 'c1');
      const c2 = points.find((p) => p.cellId === 'c2');
      expect(c1?.kind).toBe('cluster');
      expect(c1?.count).toBe(5);
      expect(c1?.by).toEqual({ user: 3, event: 2 });
      expect(c2?.count).toBe(1);
      expect(c2?.by).toEqual({ user: 1 });
    });
  });

  describe('snapshot + diff protocol', () => {
    const p = (id: string) => ({ id, kind: 'event', lat: 1, lng: 2, meta: {} });

    it('always stores the current snapshot with a TTL', async () => {
      query.mockResolvedValueOnce([p('e1')]);
      const res = await call();
      expect(redisSet).toHaveBeenCalledWith(
        `discovery:snap:${res.viewportHash}`,
        expect.any(String),
        'EX',
        30,
      );
    });

    it('returns a diff (and empty points) when a prior snapshot overlaps', async () => {
      query.mockResolvedValueOnce([p('e1'), p('e2')]);
      redisGet.mockResolvedValue(JSON.stringify([p('e1')]));

      const res = await call({ prevViewportHash: 'prev' });

      expect(res.points).toEqual([]);
      expect(res.diff).toBeTruthy();
      expect(asPoints(res.diff!.added).map((x) => x.id)).toEqual(['e2']);
      expect(res.diff!.removed).toEqual([]);
    });

    it('falls back to a full response when the prior snapshot expired', async () => {
      query.mockResolvedValueOnce([p('e1')]);
      redisGet.mockResolvedValue(null);

      const res = await call({ prevViewportHash: 'prev' });
      expect(res.diff).toBeNull();
      expect(asPoints(res.points).map((x) => x.id)).toEqual(['e1']);
    });

    it('falls back to a full response on a big viewport jump (>60% removed)', async () => {
      query.mockResolvedValueOnce([p('e9')]);
      redisGet.mockResolvedValue(JSON.stringify([p('e1'), p('e2'), p('e3')]));

      const res = await call({ prevViewportHash: 'prev' });
      expect(res.diff).toBeNull();
      expect(asPoints(res.points).map((x) => x.id)).toEqual(['e9']);
    });

    it('emits an empty diff when nothing changed', async () => {
      query.mockResolvedValueOnce([p('e1')]);
      redisGet.mockResolvedValue(JSON.stringify([p('e1')]));

      const res = await call({ prevViewportHash: 'prev' });
      expect(res.points).toEqual([]);
      expect(res.diff).toEqual({ added: [], removed: [] });
    });

    it('treats a same-key content change as remove+add, not silently stale', async () => {
      const fresh = { id: 'e1', kind: 'event', lat: 1, lng: 2, meta: { attendeeCount: 9 } };
      query.mockResolvedValueOnce([fresh]);
      redisGet.mockResolvedValue(
        JSON.stringify([{ id: 'e1', kind: 'event', lat: 1, lng: 2, meta: { attendeeCount: 3 } }]),
      );

      const res = await call({ prevViewportHash: 'prev' });

      expect(res.diff).toBeTruthy();
      expect(res.diff!.removed).toEqual(['e1']);
      expect(asPoints(res.diff!.added)).toEqual([fresh]);
    });

    it('does not flag a real overlap as changed due to key-insertion-order alone', async () => {
      query.mockResolvedValueOnce([p('e1')]);
      redisGet.mockResolvedValue(JSON.stringify([p('e1')]));

      const res = await call({ prevViewportHash: 'prev' });
      expect(res.diff).toEqual({ added: [], removed: [] });
    });
  });
});
