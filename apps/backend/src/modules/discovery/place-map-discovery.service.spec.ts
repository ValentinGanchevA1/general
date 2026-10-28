import { DataSource } from 'typeorm';
import * as h3 from 'h3-js';

import { PlaceMapDiscoveryService } from './place-map-discovery.service';

const placeCell = '871e85992ffffff';
const [placeLat, placeLng] = h3.cellToLatLng(placeCell);
const viewport = {
  sw: { lat: placeLat - 0.04, lng: placeLng - 0.04 },
  ne: { lat: placeLat + 0.04, lng: placeLng + 0.04 },
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

    const result = await service.nearby(viewport, 15);

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
    expect(sql).not.toContain('distinct_user_count');
  });

  it('clusters place entities without exposing check-in or participant counts', async () => {
    query.mockResolvedValueOnce([
      row('place-1', 'Sea Garden'),
      row('place-2', 'Nearby Place'),
    ]);

    const result = await service.nearby(viewport, 8);
    const clusters = result.points.filter((point) => point.kind === 'cluster');

    expect(clusters.length).toBeGreaterThan(0);
    expect(clusters.reduce((sum, cluster) => sum + (cluster.by.place ?? 0), 0)).toBe(2);
    for (const cluster of clusters) {
      expect(Object.keys(cluster.by)).toEqual(['place']);
    }
  });

  it('fails closed before querying places for an oversized high-zoom viewport', async () => {
    const oversizedViewport = {
      sw: { lat: placeLat - 0.2, lng: placeLng - 0.2 },
      ne: { lat: placeLat + 0.2, lng: placeLng + 0.2 },
    };

    const result = await service.nearby(oversizedViewport, 15);

    expect(result.points).toEqual([]);
    expect(query).not.toHaveBeenCalled();
  });

  it('fails closed for malformed or non-r7 stored cells', async () => {
    query.mockResolvedValueOnce([
      row('bad-1', 'Malformed', 'not-a-cell'),
      row('bad-2', 'Wrong resolution', h3.cellToParent(placeCell, 6)),
    ]);

    await expect(service.nearby(viewport, 15)).resolves.toMatchObject({ points: [] });
  });
});
