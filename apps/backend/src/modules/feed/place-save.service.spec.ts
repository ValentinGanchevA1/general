import { DataSource, type EntityManager } from 'typeorm';

import { PlaceCatalogService } from './place-catalog.service';
import { PlaceSaveService } from './place-save.service';

const canonicalPlace = {
  id: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
  canonicalLabel: 'Sea Garden',
  locationH3R7: '871e85992ffffff',
};

describe('PlaceSaveService', () => {
  let dbQuery: jest.Mock;
  let managerQuery: jest.Mock;
  let transaction: jest.Mock;
  let getActivePlace: jest.Mock;
  let service: PlaceSaveService;

  beforeEach(() => {
    dbQuery = jest.fn();
    managerQuery = jest.fn();
    const manager = { query: managerQuery } as unknown as EntityManager;
    transaction = jest.fn(async (callback: (value: EntityManager) => Promise<unknown>) => callback(manager));
    getActivePlace = jest.fn().mockResolvedValue(canonicalPlace);
    service = new PlaceSaveService(
      { query: dbQuery, transaction } as unknown as DataSource,
      { getActivePlace } as unknown as PlaceCatalogService,
    );
  });

  it('reads private save state across bounded merged aliases without exposing a count', async () => {
    dbQuery.mockResolvedValueOnce([{ saved: true }]);

    await expect(
      service.getState('user-1', 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb'),
    ).resolves.toEqual({ placeId: canonicalPlace.id, saved: true });

    expect(getActivePlace).toHaveBeenCalledWith('bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb');
    expect(dbQuery).toHaveBeenCalledWith(
      expect.stringContaining('SELECT EXISTS'),
      ['user-1', canonicalPlace.id],
    );
    const sql = String(dbQuery.mock.calls[0]?.[0]);
    expect(sql).toContain('a.depth < 5');
    expect(sql).not.toContain('COUNT(');
  });

  it('lists canonical private bookmarks with only coarse location and thresholded trend state', async () => {
    const savedAt = new Date('2026-10-28T04:30:00.000Z');
    const emittedAt = new Date('2026-10-28T04:40:00.000Z');
    dbQuery.mockResolvedValueOnce([{
      id: canonicalPlace.id,
      canonical_label: canonicalPlace.canonicalLabel,
      location_h3_r7: canonicalPlace.locationH3R7,
      saved_at: savedAt,
      last_emitted_at: emittedAt,
    }]);

    const page = await service.listSaved('user-1', 30, 0);

    expect(page).toEqual({
      items: [{
        id: canonicalPlace.id,
        canonicalLabel: canonicalPlace.canonicalLabel,
        approximateLocation: { lat: expect.any(Number), lng: expect.any(Number) },
        locationPrecision: 'coarse',
        trending: true,
        recentActivityAt: emittedAt.toISOString(),
        savedAt: savedAt.toISOString(),
      }],
      nextOffset: null,
    });
    const sql = String(dbQuery.mock.calls[0]?.[0]);
    expect(sql).toContain('GROUP BY place_id');
    expect(sql).toContain('c.depth < 5');
    expect(sql).toContain('LIMIT $2 OFFSET $3');
    expect(dbQuery).toHaveBeenCalledWith(expect.any(String), ['user-1', 31, 0]);
    const serialized = JSON.stringify(page);
    expect(serialized).not.toContain('maptiler');
    expect(serialized).not.toContain(canonicalPlace.locationH3R7);
    expect(serialized).not.toContain('count');
  });

  it('returns a bounded next offset and drops malformed stored place cells', async () => {
    const rows = Array.from({ length: 3 }, (_, index) => ({
      id: `place-${index}`,
      canonical_label: `Place ${index}`,
      location_h3_r7: index === 0 ? canonicalPlace.locationH3R7 : 'invalid',
      saved_at: new Date(`2026-10-28T04:3${index}:00.000Z`),
      last_emitted_at: null,
    }));
    dbQuery.mockResolvedValueOnce(rows);

    const page = await service.listSaved('user-1', 2, 5);

    expect(page.items).toHaveLength(1);
    expect(page.nextOffset).toBe(7);
    expect(dbQuery).toHaveBeenCalledWith(expect.any(String), ['user-1', 3, 5]);
  });

  it('saves only the canonical place id and removes obsolete merged-alias bookmarks', async () => {
    managerQuery.mockResolvedValue([]);

    await expect(service.save('user-1', 'place-old')).resolves.toEqual({
      placeId: canonicalPlace.id,
      saved: true,
    });

    expect(managerQuery).toHaveBeenNthCalledWith(
      1,
      expect.stringContaining('INSERT INTO nexa_place_saves'),
      ['user-1', canonicalPlace.id],
    );
    expect(String(managerQuery.mock.calls[0]?.[0])).toContain('ON CONFLICT (user_id, place_id) DO NOTHING');
    expect(managerQuery).toHaveBeenNthCalledWith(
      2,
      expect.stringContaining('DELETE FROM nexa_place_saves'),
      ['user-1', canonicalPlace.id],
    );
    expect(String(managerQuery.mock.calls[1]?.[0])).toContain('a.depth < 5');
  });

  it('unsaves the canonical place and any merged aliases idempotently', async () => {
    dbQuery.mockResolvedValueOnce([]);

    await expect(service.unsave('user-1', canonicalPlace.id)).resolves.toEqual({
      placeId: canonicalPlace.id,
      saved: false,
    });

    expect(dbQuery).toHaveBeenCalledWith(
      expect.stringContaining('DELETE FROM nexa_place_saves'),
      ['user-1', canonicalPlace.id],
    );
    expect(String(dbQuery.mock.calls[0]?.[0])).toContain('SELECT id, 0');
  });

  it('fails closed without writing when the place cannot resolve to an active canonical entity', async () => {
    getActivePlace.mockResolvedValueOnce(null);

    await expect(service.save('user-1', 'missing-place')).resolves.toBeNull();
    expect(transaction).not.toHaveBeenCalled();
    expect(managerQuery).not.toHaveBeenCalled();
  });
});
