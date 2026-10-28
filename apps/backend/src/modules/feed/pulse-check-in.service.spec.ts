import { DataSource } from 'typeorm';

import { computeH3Cells, type CreatePulseCheckInRequest, type PlaceIdentity } from '@g88/shared';

import { MapTilerPlaceAttestationService } from './maptiler-place-attestation.service';
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

const clientIdentity: PlaceIdentity = {
  provider: 'maptiler',
  providerPlaceId: 'poi.12345',
  canonicalLabel: 'Client supplied label',
  providerCellH3R7: computeH3Cells(43.2200, 27.9200).r7,
};

const attestedIdentity: PlaceIdentity = {
  provider: 'maptiler',
  providerPlaceId: 'poi.12345',
  canonicalLabel: 'Sea Garden',
  providerCellH3R7: computeH3Cells(request.lat, request.lng).r7,
};

describe('PulseCheckInService', () => {
  let query: jest.Mock;
  let publishCheckIn: jest.Mock;
  let evaluateAfterCheckIn: jest.Mock;
  let attest: jest.Mock;
  let service: PulseCheckInService;

  beforeEach(() => {
    query = jest.fn();
    publishCheckIn = jest.fn().mockResolvedValue(undefined);
    evaluateAfterCheckIn = jest.fn().mockResolvedValue(undefined);
    attest = jest.fn().mockResolvedValue(attestedIdentity);
    const realtime = { publishCheckIn } as unknown as PulseActivityRealtimeService;
    const trending = { evaluateAfterCheckIn } as unknown as PulsePlaceTrendingService;
    const placeAttestation = { attest } as unknown as MapTilerPlaceAttestationService;
    service = new PulseCheckInService(
      { query } as unknown as DataSource,
      realtime,
      trending,
      placeAttestation,
    );
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
    expect(attest).not.toHaveBeenCalled();
    expect(evaluateAfterCheckIn).not.toHaveBeenCalled();
  });

  it('persists only the server-attested provider identity and evaluates canonical Nearby places', async () => {
    query.mockResolvedValueOnce([]).mockResolvedValueOnce([]);

    const result = await service.create('user-1', {
      ...request,
      audience: 'nearby',
      placeIdentity: clientIdentity,
    });

    expect(attest).toHaveBeenCalledWith(clientIdentity, expect.any(String));
    expect(result.placeIdentity).toEqual(attestedIdentity);
    expect(result.placeLabel).toBe('Sea Garden');
    const insertParams = query.mock.calls[1]?.[1] as unknown[];
    expect(insertParams.slice(5, 8)).toEqual([
      'maptiler',
      'poi.12345',
      attestedIdentity.providerCellH3R7,
    ]);
    expect(evaluateAfterCheckIn).toHaveBeenCalledWith({ placeIdentity: attestedIdentity });
  });

  it('downgrades an unattested canonical request to free text without contributing to trends', async () => {
    query.mockResolvedValueOnce([]).mockResolvedValueOnce([]);
    attest.mockResolvedValueOnce(null);

    const result = await service.create('user-1', {
      ...request,
      audience: 'nearby',
      placeLabel: 'My custom Sea Garden label',
      placeIdentity: clientIdentity,
    });

    expect(result.placeIdentity).toBeNull();
    expect(result.placeLabel).toBe('My custom Sea Garden label');
    const insertParams = query.mock.calls[1]?.[1] as unknown[];
    expect(insertParams.slice(5, 8)).toEqual([null, null, null]);
    expect(evaluateAfterCheckIn).not.toHaveBeenCalled();
  });

  it('does not trend a Nearby free-text place', async () => {
    query.mockResolvedValueOnce([]).mockResolvedValueOnce([]);
    await service.create('user-1', { ...request, audience: 'nearby' });
    expect(attest).not.toHaveBeenCalled();
    expect(evaluateAfterCheckIn).not.toHaveBeenCalled();
  });

  it('rejects another check-in during the cooldown window before provider attestation', async () => {
    query.mockResolvedValueOnce([{ id: 'recent-check-in' }]);
    await expect(service.create('user-1', {
      ...request,
      placeIdentity: clientIdentity,
    })).rejects.toMatchObject({ status: 429 });
    expect(query).toHaveBeenCalledTimes(1);
    expect(attest).not.toHaveBeenCalled();
    expect(publishCheckIn).not.toHaveBeenCalled();
    expect(evaluateAfterCheckIn).not.toHaveBeenCalled();
  });

  it('rejects control characters in user-authored place labels', async () => {
    await expect(service.create('user-1', { ...request, placeLabel: 'Sea\nGarden' }))
      .rejects.toMatchObject({ status: 400 });
    expect(query).not.toHaveBeenCalled();
    expect(attest).not.toHaveBeenCalled();
  });

  it('keeps the API successful when realtime delivery fails after persistence', async () => {
    query.mockResolvedValueOnce([]).mockResolvedValueOnce([]);
    publishCheckIn.mockRejectedValueOnce(new Error('redis unavailable'));
    await expect(service.create('user-1', request)).resolves.toMatchObject({ placeLabel: 'Sea Garden' });
  });
});
