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
import { REDIS_CLIENT } from '../../config/redis.provider';

const VIEWPORT: Viewport = { ne: { lat: 2, lng: 2 }, sw: { lat: 1, lng: 1 } };

// Structural view over the DiscoveryPoint union for assertions (cluster vs entity).
type LoosePoint = {
  kind: string;
  id?: string;
  cellId?: string;
  count?: number;
  by?: Record<string, number>;
  meta?: Record<string, unknown>;
};
const asPoints = (ps: unknown): LoosePoint[] => ps as LoosePoint[];

describe('DiscoveryService', () => {
  let service: DiscoveryService;
  let query: jest.Mock;
  let whichAreOnline: jest.Mock;
  let redisGet: jest.Mock;
  let redisSet: jest.Mock;

  beforeEach(async () => {
    (h3ResolutionForZoom as jest.Mock).mockReturnValue(8);
    (isEntityZoom as jest.Mock).mockReturnValue(true);
    (cellsForViewport as jest.Mock).mockReturnValue(['c1']);

    query = jest.fn().mockResolvedValue([]);
    whichAreOnline = jest.fn().mockResolvedValue(new Set<string>());
    redisGet = jest.fn().mockResolvedValue(null);
    redisSet = jest.fn().mockResolvedValue('OK');

    const mod = await Test.createTestingModule({
      providers: [
        DiscoveryService,
        { provide: getDataSourceToken(), useValue: { query } as unknown as DataSource },
        { provide: PresenceService, useValue: { whichAreOnline } },
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

    it('does not refuse a narrow antimeridian-crossing viewport (normalized lng delta)', async () => {
      // sw.lng=179, ne.lng=-179 is a ~2° span across the dateline. A naive
      // ne.lng - sw.lng = -358° would inflate the area estimate past the cell
      // cap and wrongly refuse; the normalized delta keeps it queryable.
      const antimeridian: Viewport = { ne: { lat: 2, lng: -179 }, sw: { lat: 1, lng: 179 } };
      await call({ viewport: antimeridian });
      expect(query).toHaveBeenCalled();
    });

    it('still refuses a genuinely wide antimeridian-crossing viewport', async () => {
      // sw.lng=179, ne.lng=-1 wraps the dateline by a real ~180° span. The raw
      // ne.lng - sw.lng = -180° would give a negative area that slips under the
      // cap; the normalized 180° delta correctly estimates it past the limit.
      const wide: Viewport = { ne: { lat: 2, lng: -1 }, sw: { lat: 1, lng: 179 } };
      const res = await call({ viewport: wide });
      expect(res.points).toEqual([]);
      expect(query).not.toHaveBeenCalled();
    });

    it('defaults to all kinds and excludes the requester / private rows', async () => {
      await call();
      const [, params] = query.mock.calls[0]!;
      expect(params[1]).toEqual(['user', 'event', 'listing']); // DEFAULT_KINDS
      expect(params[2]).toBe('me'); // requester excluded
      expect(query.mock.calls[0]![0]).toContain("visibility = 'public'");
    });
  });

  describe('entity zoom — individual points + presence overlay', () => {
    beforeEach(() => (isEntityZoom as jest.Mock).mockReturnValue(true));

    const userMeta = { displayName: 'A', avatarUrl: null, verification: 'email', online: false, lastSeenAt: null };

    it('overlays live Redis presence onto user points and passes other kinds through', async () => {
      query.mockResolvedValueOnce([
        { id: 'u1', kind: 'user', lat: 10, lng: 20, meta: { ...userMeta } },
        { id: 'e1', kind: 'event', lat: 11, lng: 21, meta: { title: 'Party' } },
      ]);
      whichAreOnline.mockResolvedValue(new Set(['u1']));

      const res = await call();

      expect(whichAreOnline).toHaveBeenCalledWith(['u1']);
      const points = asPoints(res.points);
      const user = points.find((p) => p.kind === 'user');
      const event = points.find((p) => p.kind === 'event');
      expect(user?.meta?.online).toBe(true); // view hardcodes false; Redis overrides
      expect(event?.meta).toEqual({ title: 'Party' });
    });

    it('does not call presence when there are no user rows', async () => {
      query.mockResolvedValueOnce([{ id: 'e1', kind: 'event', lat: 11, lng: 21, meta: {} }]);
      await call();
      expect(whichAreOnline).not.toHaveBeenCalled();
    });
  });

  describe('topic filter (P3.6)', () => {
    it('restricts kinds to event/listing, slugifies, and binds the normalized topic', async () => {
      await call({ topic: '#Open-Mic' });
      const [sql, params] = query.mock.calls[0]!;
      // users dropped (no topic), only event/listing remain
      expect(params[1]).toEqual(['event', 'listing']);
      // slug clause present, matching on g88_slugify of title/category
      expect(sql).toContain('g88_slugify');
      // '#Open-Mic' normalized to bare lowercase slug, bound as the last param
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
      query.mockResolvedValueOnce([p('e1'), p('e2')]); // current
      redisGet.mockResolvedValue(JSON.stringify([p('e1')])); // prev had only e1

      const res = await call({ prevViewportHash: 'prev' });

      expect(res.points).toEqual([]); // client keeps cache, applies diff
      expect(res.diff).toBeTruthy();
      expect(asPoints(res.diff!.added).map((x) => x.id)).toEqual(['e2']);
      expect(res.diff!.removed).toEqual([]);
    });

    it('falls back to a full response when the prior snapshot expired', async () => {
      query.mockResolvedValueOnce([p('e1')]);
      redisGet.mockResolvedValue(null); // expired / missing

      const res = await call({ prevViewportHash: 'prev' });
      expect(res.diff).toBeNull();
      expect(asPoints(res.points).map((x) => x.id)).toEqual(['e1']);
    });

    it('falls back to a full response on a big viewport jump (>60% removed)', async () => {
      query.mockResolvedValueOnce([p('e9')]); // current shares nothing with prev
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
  });
});
