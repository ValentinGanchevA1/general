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
