import { DataSource, type EntityManager } from 'typeorm';
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

function catalogRow(id: string, label: string, cell = placeCell) {
  return {
    id,
    canonical_label: label,
    location_h3_r7: cell,
    status: 'active' as const,
    merged_into_place_id: null,
  };
}

function mapTilerPayload(id = 'poi.123', label = 'Sea Garden') {
  return {
    type: 'FeatureCollection',
    features: [
      {
        id,
        text: label,
        place_name: `${label}, Varna, Bulgaria`,
        center: [placeLng, placeLat],
        geometry: { type: 'Point', coordinates: [placeLng, placeLat] },
      },
    ],
  };
}

function providerFetch(payload: unknown, ok = true): jest.Mock {
  return jest.fn().mockResolvedValue({
    ok,
    headers: { get: jest.fn(() => null) },
    text: jest.fn(async () => JSON.stringify(payload)),
  });
}

describe('PlaceMapDiscoveryService', () => {
  let query: jest.Mock;
  let transaction: jest.Mock;
  let service: PlaceMapDiscoveryService;
  let originalFetch: typeof global.fetch;
  let originalServerApiKey: string | undefined;
  let originalMapTilerRegion: string | undefined;

  beforeEach(() => {
    originalFetch = global.fetch;
    originalServerApiKey = process.env.NEXA_MAPTILER_SERVER_API_KEY;
    originalMapTilerRegion = process.env.NEXA_MAPTILER_REGION;
    delete process.env.NEXA_MAPTILER_SERVER_API_KEY;
    delete process.env.NEXA_MAPTILER_REGION;

    query = jest.fn();
    transaction = jest.fn();
    service = new PlaceMapDiscoveryService({ query, transaction } as unknown as DataSource);
  });

  afterEach(() => {
    global.fetch = originalFetch;
    if (originalServerApiKey == null) delete process.env.NEXA_MAPTILER_SERVER_API_KEY;
    else process.env.NEXA_MAPTILER_SERVER_API_KEY = originalServerApiKey;
    if (originalMapTilerRegion == null) delete process.env.NEXA_MAPTILER_REGION;
    else process.env.NEXA_MAPTILER_REGION = originalMapTilerRegion;
    jest.restoreAllMocks();
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

  it('discovers nearby provider POIs as non-trending coarse Places at entity zoom', async () => {
    process.env.NEXA_MAPTILER_SERVER_API_KEY = 'server-key';
    global.fetch = providerFetch(mapTilerPayload()) as unknown as typeof global.fetch;
    query.mockResolvedValueOnce([]);

    const managerQuery = jest.fn(async (sql: string) => {
      if (sql.includes('pg_advisory_xact_lock')) return [];
      if (sql.includes('FROM nexa_place_external_refs')) return [];
      if (sql.includes('INSERT INTO nexa_places')) return [catalogRow('place-provider', 'Sea Garden')];
      if (sql.includes('INSERT INTO nexa_place_external_refs')) return [];
      throw new Error(`Unexpected SQL: ${sql}`);
    });
    transaction.mockImplementation(async (work: (manager: EntityManager) => Promise<unknown>) => (
      work({ query: managerQuery } as unknown as EntityManager)
    ));

    const result = await service.nearby(entityViewport, 15);

    expect(result.points).toEqual([
      expect.objectContaining({
        kind: 'place',
        id: 'place-provider',
        lat: placeLat,
        lng: placeLng,
        meta: {
          canonicalLabel: 'Sea Garden',
          trending: false,
          recentActivityAt: null,
          locationPrecision: 'coarse',
        },
      }),
    ]);
    expect(global.fetch).toHaveBeenCalledTimes(1);
    expect(String((global.fetch as jest.Mock).mock.calls[0]?.[0])).toContain('/geocoding/');
    expect(String((global.fetch as jest.Mock).mock.calls[0]?.[0])).toContain('types=poi');
    expect(managerQuery.mock.calls.some(([sql]) => String(sql).includes('INSERT INTO nexa_places'))).toBe(true);
    expect(managerQuery.mock.calls.some(([sql]) => String(sql).includes('INSERT INTO nexa_place_external_refs'))).toBe(true);
  });

  it('keeps k-anonymous trend metadata authoritative when provider discovery returns the same Place', async () => {
    process.env.NEXA_MAPTILER_SERVER_API_KEY = 'server-key';
    global.fetch = providerFetch(mapTilerPayload()) as unknown as typeof global.fetch;
    query.mockResolvedValueOnce([row('place-provider', 'Sea Garden')]);

    const managerQuery = jest.fn(async (sql: string) => {
      if (sql.includes('pg_advisory_xact_lock')) return [];
      if (sql.includes('FROM nexa_place_external_refs')) return [catalogRow('place-provider', 'Sea Garden')];
      if (sql.includes('UPDATE nexa_places')) return [catalogRow('place-provider', 'Sea Garden')];
      throw new Error(`Unexpected SQL: ${sql}`);
    });
    transaction.mockImplementation(async (work: (manager: EntityManager) => Promise<unknown>) => (
      work({ query: managerQuery } as unknown as EntityManager)
    ));

    const result = await service.nearby(entityViewport, 15);

    expect(result.points).toHaveLength(1);
    expect(result.points[0]).toMatchObject({
      kind: 'place',
      id: 'place-provider',
      meta: {
        canonicalLabel: 'Sea Garden',
        trending: true,
        recentActivityAt: '2026-10-28T03:00:00.000Z',
        locationPrecision: 'coarse',
      },
    });
  });

  it('fails soft to thresholded Places when provider discovery is unavailable', async () => {
    process.env.NEXA_MAPTILER_SERVER_API_KEY = 'server-key';
    global.fetch = providerFetch({}, false) as unknown as typeof global.fetch;
    query.mockResolvedValueOnce([row('place-1', 'Sea Garden')]);

    const result = await service.nearby(entityViewport, 15);

    expect(result.points).toHaveLength(1);
    expect(result.points[0]).toMatchObject({ kind: 'place', id: 'place-1', meta: { trending: true } });
    expect(transaction).not.toHaveBeenCalled();
  });

  it('does not call the provider at cluster zoom, preserving broad-map privacy and request bounds', async () => {
    process.env.NEXA_MAPTILER_SERVER_API_KEY = 'server-key';
    global.fetch = providerFetch(mapTilerPayload()) as unknown as typeof global.fetch;
    query.mockResolvedValueOnce([row('place-1', 'Sea Garden')]);

    await service.nearby(clusterViewport, 8);

    expect(global.fetch).not.toHaveBeenCalled();
    expect(transaction).not.toHaveBeenCalled();
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
    expect(transaction).not.toHaveBeenCalled();
  });

  it('fails closed for malformed or non-r7 stored cells', async () => {
    query.mockResolvedValueOnce([
      row('bad-1', 'Malformed', 'not-a-cell'),
      row('bad-2', 'Wrong resolution', h3.cellToParent(placeCell, 6)),
    ]);

    await expect(service.nearby(entityViewport, 15)).resolves.toMatchObject({ points: [] });
  });
});
