import { DataSource } from 'typeorm';

import type { CreatePulseCheckInRequest } from '@g88/shared';

import { PulseActivityRealtimeService } from './pulse-activity-realtime.service';
import { PulseCheckInService } from './pulse-check-in.service';
import { PulsePlaceTrendingService } from './pulse-place-trending.service';

const request: CreatePulseCheckInRequest = {
  placeLabel: 'Sea Garden',
  audience: 'friends',
  lat: 43.2047,
  lng: 27.9105,
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
    service = new PulseCheckInService(
      { query } as unknown as DataSource,
      realtime,
      trending,
    );
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
    expect(publishCheckIn).toHaveBeenCalledWith(expect.objectContaining({
      actorId: 'user-1',
      placeLabel: 'Sea Garden',
      audience: 'friends',
      locationH3R7: insertParams[4],
    }));
    expect(evaluateAfterCheckIn).not.toHaveBeenCalled();
  });

  it('evaluates a place trend only after an explicit Nearby check-in persists', async () => {
    query.mockResolvedValueOnce([]).mockResolvedValueOnce([]);

    await service.create('user-1', { ...request, audience: 'nearby' });

    const insertParams = query.mock.calls[1]?.[1] as unknown[];
    expect(evaluateAfterCheckIn).toHaveBeenCalledTimes(1);
    expect(evaluateAfterCheckIn).toHaveBeenCalledWith({
      placeLabel: 'Sea Garden',
      locationH3R7: insertParams[4],
    });
  });

  it('rejects another check-in during the cooldown window', async () => {
    query.mockResolvedValueOnce([{ id: 'recent-check-in' }]);

    await expect(service.create('user-1', request)).rejects.toMatchObject({ status: 429 });
    expect(query).toHaveBeenCalledTimes(1);
    expect(publishCheckIn).not.toHaveBeenCalled();
    expect(evaluateAfterCheckIn).not.toHaveBeenCalled();
  });

  it('rejects control characters in user-authored place labels', async () => {
    await expect(service.create('user-1', {
      ...request,
      placeLabel: 'Sea\nGarden',
    })).rejects.toMatchObject({ status: 400 });
    expect(query).not.toHaveBeenCalled();
    expect(publishCheckIn).not.toHaveBeenCalled();
    expect(evaluateAfterCheckIn).not.toHaveBeenCalled();
  });

  it('keeps the API successful when realtime delivery fails after persistence', async () => {
    query.mockResolvedValueOnce([]).mockResolvedValueOnce([]);
    publishCheckIn.mockRejectedValueOnce(new Error('redis unavailable'));

    await expect(service.create('user-1', request)).resolves.toMatchObject({
      placeLabel: 'Sea Garden',
    });
  });
});
