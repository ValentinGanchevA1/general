import type { EntityManager } from 'typeorm';
import { DataSource } from 'typeorm';

import type { AttestedPlace } from './maptiler-place-attestation.service';
import { PlaceCatalogService } from './place-catalog.service';

const attested: AttestedPlace = {
  identity: {
    provider: 'maptiler',
    providerPlaceId: 'poi.22222',
    canonicalLabel: 'Sea Garden',
    providerCellH3R7: '871e85992ffffff',
  },
  stableExternalRef: { namespace: 'osm', externalId: 'r71525' },
};

const placeRow = {
  id: 'place-1',
  canonical_label: 'Sea Garden',
  location_h3_r7: '871e85992ffffff',
  status: 'active' as const,
  merged_into_place_id: null,
};

describe('PlaceCatalogService', () => {
  let query: jest.Mock;
  let transaction: jest.Mock;
  let service: PlaceCatalogService;

  beforeEach(() => {
    query = jest.fn();
    const manager = { query } as unknown as EntityManager;
    transaction = jest.fn(async (callback: (value: EntityManager) => Promise<unknown>) => callback(manager));
    service = new PlaceCatalogService({ transaction } as unknown as DataSource);
  });

  it('reuses the stable OSM ref when a MapTiler feature ID changes', async () => {
    query
      .mockResolvedValueOnce([]) // maptiler advisory lock
      .mockResolvedValueOnce([]) // osm advisory lock
      .mockResolvedValueOnce([]) // feature ref lookup
      .mockResolvedValueOnce([placeRow]) // stable ref lookup
      .mockResolvedValueOnce([placeRow]) // refresh canonical data
      .mockResolvedValueOnce([]) // attach new feature alias
      .mockResolvedValueOnce([]); // refresh stable alias

    await expect(service.resolve(attested)).resolves.toEqual({
      id: 'place-1',
      canonicalLabel: 'Sea Garden',
      locationH3R7: '871e85992ffffff',
    });

    const sql = query.mock.calls.map((call) => String(call[0])).join('\n');
    expect(sql).not.toContain('INSERT INTO nexa_places\n');
    expect(sql).toContain('INSERT INTO nexa_place_external_refs');
    expect(query).toHaveBeenCalledWith(
      expect.stringContaining('INSERT INTO nexa_place_external_refs'),
      ['place-1', 'maptiler', 'poi.22222'],
    );
  });

  it('creates a new NEXA place when no trusted external ref is known', async () => {
    query
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([{ ...placeRow, id: 'place-new' }])
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([]);

    await expect(service.resolve(attested)).resolves.toMatchObject({ id: 'place-new' });
    expect(query).toHaveBeenCalledWith(
      expect.stringContaining('INSERT INTO nexa_places'),
      ['Sea Garden', '871e85992ffffff'],
    );
  });

  it('does not reconcile places by label or H3 alone', async () => {
    query
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([{ ...placeRow, id: 'place-new' }])
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([]);

    await service.resolve(attested);

    const lookupSql = query.mock.calls
      .slice(2, 4)
      .map((call) => String(call[0]))
      .join('\n');
    expect(lookupSql).not.toContain('canonical_label =');
    expect(lookupSql).not.toContain('location_h3_r7 =');
  });

  it('fails closed when stable and feature refs point to different NEXA places', async () => {
    query
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([{ ...placeRow, id: 'place-feature' }])
      .mockResolvedValueOnce([{ ...placeRow, id: 'place-stable' }]);

    await expect(service.resolve(attested)).rejects.toThrow('Conflicting external place references.');
    expect(query.mock.calls.some((call) => String(call[0]).includes('UPDATE nexa_places'))).toBe(false);
  });

  it('uses the provider feature ID alone when no stable upstream ref exists', async () => {
    query
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([placeRow])
      .mockResolvedValueOnce([placeRow])
      .mockResolvedValueOnce([]);

    await expect(service.resolve({ ...attested, stableExternalRef: null })).resolves.toMatchObject({ id: 'place-1' });
    expect(query).toHaveBeenCalledWith(
      expect.stringContaining('WHERE r.namespace = $1'),
      ['maptiler', 'poi.22222'],
    );
  });
});
