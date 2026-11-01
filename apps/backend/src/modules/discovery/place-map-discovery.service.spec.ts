import { DataSource } from 'typeorm';
import * as h3 from 'h3-js';

import { PlaceMapDiscoveryService } from './place-map-discovery.service';

const placeCell = '871e85992ffffff';
const neighbourCell = h3.gridDisk(placeCell, 1).find((cell) => cell !== placeCell);
if (neighbourCell == null) throw new Error('Expected an r7 neighbour cell for Place discovery tests');
const [placeLat, placeLng] = h3.cellToLatLng(placeCell);
const entityViewport = {
  sw: { lat: placeLat - 0.04, lng: placeLng - 0.04 },
  ne: { lat: placeLat + 0.04, lng: placeLng + 0.04 },
};
const clusterViewport = {
  sw: { lat: placeLat - 0.2, lng: placeLng - 0.2 },
  ne: { lat: placeLat + 0.2, lng: placeLng + 0.2 },
};

function row(id: string, label: string, cell = placeCell) {
  return {
    id,
    canonical_label: label,
    location_h3_r7: cell,
    last_emitted_at: new Date('2026-10-28T03:00:00.000Z'),
  };
}

describe('PlaceMapDiscoveryService', () => {
  let query: jest.Mock;
  let service: PlaceMapDiscoveryService;

  beforeEach(() => {
    query = jest.fn();
    service = new PlaceMapDiscoveryService({ query } as unknown as DataSource);
  });

  it('returns active thresholded places as coarse entity pins at entity zoom', async () => {
    query.mockResolvedValueOnce([row('place-1', 'Sea Garden')]);

    const result = await service.nearby(entityViewport, 15);

    expect(result.points).toEqual([
      expect.objectContaining({
        kind: 'place',
        id: 'place-1',
        lat: placeLat,
        lng: placeLng,
        meta: {
          canonicalLabel: 'Sea Garden',
          trending: true,
          recentActivityAt: '2026-10-28T03:00:00.000Z',
          locationPrecision: 'coarse',
        },
      }),
    ]);
    const sql = String(query.mock.calls[0]?.[0]);
    expect(sql).toContain('t.expires_at > NOW()');
    expect(sql).toContain("p.status = 'active'");
    expect(sql).toContain('ORDER BY t.last_emitted_at DESC');
    expect(sql).not.toContain('distinct_user_count');
  });

  it('ranks Place entity pins nearest to the viewport centre in distance mode', async () => {
    query.mockResolvedValueOnce([
      row('farther', 'Neighbour Place', neighbourCell),
      row('nearest', 'Viewport Centre Place'),
    ]);

    const result = await service.nearby(entityViewport, 15, undefined, 'distance');
    const ids = result.points
      .filter((point) => point.kind === 'place')
      .map((point) => point.id);

    expect(ids).toEqual(['nearest', 'farther']);
  });

  it('applies canonical-label search before ordering, limiting, and clustering', async () => {
    query.mockResolvedValueOnce([row('place-1', 'Sea Garden')]);

    await service.nearby(clusterViewport, 8, '  Sea Garden  ');

    const sql = String(query.mock.calls[0]?.[0]);
    expect(sql).toContain('STRPOS(LOWER(p.canonical_label), LOWER($2)) > 0');
    expect(sql.indexOf('STRPOS')).toBeLessThan(sql.indexOf('ORDER BY'));
    expect(sql.indexOf('STRPOS')).toBeLessThan(sql.indexOf('LIMIT $1'));
    expect(query.mock.calls[0]?.[1]).toEqual([1000, 'Sea Garden']);
  });

  it('includes normalized search and rank mode in the full-snapshot viewport hash', async () => {
    query.mockResolvedValue([]);

    const first = await service.nearby(entityViewport, 15, ' Sea ', 'relevance');
    const same = await service.nearby(entityViewport, 15, 'sea', 'relevance');
    const differentQuery = await service.nearby(entityViewport, 15, 'park', 'relevance');
    const differentRank = await service.nearby(entityViewport, 15, 'sea', 'distance');

    expect(first.viewportHash).toBe(same.viewportHash);
    expect(first.viewportHash).not.toBe(differentQuery.viewportHash);
    expect(first.viewportHash).not.toBe(differentRank.viewportHash);
  });

  it('clusters place entities without exposing check-in or participant counts', async () => {
    query.mockResolvedValueOnce([
      row('place-1', 'Sea Garden'),
      row('place-2', 'Nearby Place'),
    ]);

    const result = await service.nearby(clusterViewport, 8, undefined, 'distance');
    const clusters = result.points.filter((point) => point.kind === 'cluster');

    expect(clusters.length).toBeGreaterThan(0);
    expect(clusters.reduce((sum, cluster) => sum + (cluster.by.place ?? 0), 0)).toBe(2);
    for (const cluster of clusters) {
      expect(Object.keys(cluster.by)).toEqual(['place']);
    }
  });

  it('fails closed before querying places for an oversized high-zoom viewport', async () => {
    const result = await service.nearby(clusterViewport, 15);

    expect(result.points).toEqual([]);
    expect(query).not.toHaveBeenCalled();
  });

  it('fails closed for malformed or non-r7 stored cells', async () => {
    query.mockResolvedValueOnce([
      row('bad-1', 'Malformed', 'not-a-cell'),
      row('bad-2', 'Wrong resolution', h3.cellToParent(placeCell, 6)),
    ]);

    await expect(service.nearby(entityViewport, 15)).resolves.toMatchObject({ points: [] });
  });
});
