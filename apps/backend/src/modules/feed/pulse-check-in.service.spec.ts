import { DataSource } from 'typeorm';

import type { CreatePulseCheckInRequest } from '@g88/shared';

import { PulseCheckInService } from './pulse-check-in.service';

const request: CreatePulseCheckInRequest = {
  placeLabel: 'Sea Garden',
  audience: 'friends',
  lat: 43.2047,
  lng: 27.9105,
};

describe('PulseCheckInService', () => {
  let query: jest.Mock;
  let service: PulseCheckInService;

  beforeEach(() => {
    query = jest.fn();
    service = new PulseCheckInService({ query } as unknown as DataSource);
  });

  it('stores a coarse H3 cell instead of exact coordinates', async () => {
    query.mockResolvedValueOnce([]).mockResolvedValueOnce([]);

    const result = await service.create('user-1', request);

    expect(result.placeLabel).toBe('Sea Garden');
    expect(result.audience).toBe('friends');
    expect(query).toHaveBeenCalledTimes(2);
    expect(query.mock.calls[1]?.[0]).toContain('INSERT INTO pulse_check_ins');

    const insertParams = query.mock.calls[1]?.[1] as unknown[];
    expect(insertParams).not.toContain(request.lat);
    expect(insertParams).not.toContain(request.lng);
    expect(typeof insertParams[4]).toBe('string');
  });

  it('rejects another check-in during the cooldown window', async () => {
    query.mockResolvedValueOnce([{ id: 'recent-check-in' }]);

    await expect(service.create('user-1', request)).rejects.toMatchObject({ status: 429 });
    expect(query).toHaveBeenCalledTimes(1);
  });

  it('rejects control characters in user-authored place labels', async () => {
    await expect(service.create('user-1', {
      ...request,
      placeLabel: 'Sea\nGarden',
    })).rejects.toMatchObject({ status: 400 });
    expect(query).not.toHaveBeenCalled();
  });
});
