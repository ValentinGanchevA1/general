import { DataSource } from 'typeorm';

import { computeH3Cells, type CreatePulseCheckInRequest } from '@g88/shared';

import { PulseActivityRealtimeService } from './pulse-activity-realtime.service';
import { PulseCheckInService } from './pulse-check-in.service';
import { PulsePlaceTrendingService } from './pulse-place-trending.service';

const request: CreatePulseCheckInRequest = {
  placeLabel: 'Sea Garden',
  placeIdentity: null,
  audience: 'friends',
  lat: 43.2047,
  lng: 27.9105,
};

const canonicalIdentity = {
  provider: 'maptiler' as const,
  providerPlaceId: 'poi.sea-garden',
  canonicalLabel: 'Sea Garden',
  providerCellH3R7: computeH3Cells(request.lat, request.lng).r7,
};

describe('PulseCheckInService', () => {
  let query: jest.Mock;
  let publishCheckIn: jest.Mock;
  let evaluateAfterCheckIn: jest.Mock;
  let service: PulseCheckInService;

  beforeEach(() => {
    query = jest.fn();
    publishCheckIn = jest.fn().mockResolvedValue(undefined);
    evaluateAfterCheckIn = jest.fn().mockResolvedValue(undefined);
    const realtime = { publishCheckIn } as unknown as PulseActivityRealtimeService;
    const trending = { evaluateAfterCheckIn } as unknown as PulsePlaceTrendingService;
    service = new PulseCheckInService({ query } as unknown as DataSource, realtime, trending);
  });

  it('stores a coarse user H3 cell and preserves free-text fallback without canonical identity', async () => {
    query.mockResolvedValueOnce([]).mockResolvedValueOnce([]);

    const result = await service.create('user-1', request);

    expect(result).toMatchObject({ placeLabel: 'Sea Garden', placeIdentity: null, audience: 'friends' });
    const insertParams = query.mock.calls[1]?.[1] as unknown[];
    expect(insertParams).not.toContain(request.lat);
    expect(insertParams).not.toContain(request.lng);
    expect(typeof insertParams[4]).toBe('string');
    expect(insertParams.slice(5, 8)).toEqual([null, null, null]);
    expect(evaluateAfterCheckIn).not.toHaveBeenCalled();
  });

  it('stores provider identity and evaluates canonical Nearby places only', async () => {
    query.mockResolvedValueOnce([]).mockResolvedValueOnce([]);

    const result = await service.create('user-1', {
      ...request,
      audience: 'nearby',
      placeIdentity: canonicalIdentity,
    });

    expect(result.placeIdentity).toEqual(canonicalIdentity);
    const insertParams = query.mock.calls[1]?.[1] as unknown[];
    expect(insertParams.slice(5, 8)).toEqual([
      'maptiler',
      'poi.sea-garden',
      canonicalIdentity.providerCellH3R7,
    ]);
    expect(evaluateAfterCheckIn).toHaveBeenCalledWith({ placeIdentity: canonicalIdentity });
  });

  it('does not trend a Nearby free-text place', async () => {
    query.mockResolvedValueOnce([]).mockResolvedValueOnce([]);
    await service.create('user-1', { ...request, audience: 'nearby' });
    expect(evaluateAfterCheckIn).not.toHaveBeenCalled();
  });

  it('rejects a canonical place whose coarse provider cell is too far away', async () => {
    query.mockResolvedValueOnce([]);
    await expect(service.create('user-1', {
      ...request,
      placeIdentity: {
        ...canonicalIdentity,
        providerCellH3R7: computeH3Cells(42.6977, 23.3219).r7,
      },
    })).rejects.toMatchObject({ status: 400 });
    expect(query).toHaveBeenCalledTimes(1);
  });

  it('rejects another check-in during the cooldown window', async () => {
    query.mockResolvedValueOnce([{ id: 'recent-check-in' }]);
    await expect(service.create('user-1', request)).rejects.toMatchObject({ status: 429 });
    expect(query).toHaveBeenCalledTimes(1);
    expect(publishCheckIn).not.toHaveBeenCalled();
    expect(evaluateAfterCheckIn).not.toHaveBeenCalled();
  });

  it('rejects control characters in user-authored place labels', async () => {
    await expect(service.create('user-1', { ...request, placeLabel: 'Sea\nGarden' }))
      .rejects.toMatchObject({ status: 400 });
    expect(query).not.toHaveBeenCalled();
  });

  it('keeps the API successful when realtime delivery fails after persistence', async () => {
    query.mockResolvedValueOnce([]).mockResolvedValueOnce([]);
    publishCheckIn.mockRejectedValueOnce(new Error('redis unavailable'));
    await expect(service.create('user-1', request)).resolves.toMatchObject({ placeLabel: 'Sea Garden' });
  });
});
