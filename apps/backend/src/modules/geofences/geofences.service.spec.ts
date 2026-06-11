import { Test } from '@nestjs/testing';
import { DataSource } from 'typeorm';
import { getDataSourceToken } from '@nestjs/typeorm';
import { UnprocessableEntityException } from '@nestjs/common';
import * as h3 from 'h3-js';

import { GeofencesService } from './geofences.service';

const CELL = h3.latLngToCell(51.5, -0.12, 7); // a real r7 cell

describe('GeofencesService', () => {
  let service: GeofencesService;
  let query: jest.Mock;

  beforeEach(async () => {
    query = jest.fn().mockResolvedValue([]);
    const mod = await Test.createTestingModule({
      providers: [
        GeofencesService,
        { provide: getDataSourceToken(), useValue: { query } as unknown as DataSource },
      ],
    }).compile();
    service = mod.get(GeofencesService);
  });

  const geoRow = {
    id: 'g1', label: 'home', center_h3_r7: CELL,
    radius_rings: 1, active: true, created_at: new Date('2026-06-10T00:00:00Z'),
  };

  describe('upsert', () => {
    it('rejects with 422 when the user has no recorded location', async () => {
      query.mockResolvedValueOnce([{ location_h3_r7: null }]);
      await expect(service.upsert('u1', { label: 'home' } as never)).rejects.toBeInstanceOf(
        UnprocessableEntityException,
      );
    });

    it('anchors the geofence at the current cell and reports inside=true', async () => {
      query
        .mockResolvedValueOnce([{ location_h3_r7: CELL }]) // user location
        .mockResolvedValueOnce([geoRow]); // upsert RETURNING

      const res = await service.upsert('u1', { label: 'home', radiusRings: 1 } as never);
      expect(res).toMatchObject({ id: 'g1', centerH3R7: CELL, inside: true });
      expect(res.createdAt).toBe('2026-06-10T00:00:00.000Z');
    });
  });

  describe('getActive', () => {
    it('returns [] when the user has no active geofences', async () => {
      query.mockResolvedValueOnce([]); // geofences
      await expect(service.getActive('u1')).resolves.toEqual([]);
    });

    it('annotates inside=false when the current cell is outside the disk', async () => {
      const far = h3.latLngToCell(40.0, 100.0, 7); // far away
      query
        .mockResolvedValueOnce([geoRow]) // active geofences
        .mockResolvedValueOnce([{ location_h3_r7: far }]); // user is elsewhere
      const [g] = await service.getActive('u1');
      expect(g!.inside).toBe(false);
    });
  });
});
