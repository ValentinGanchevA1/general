import { DataSource } from 'typeorm';

import {
  computeH3Cells,
  type CreatePlacePulseCheckInRequest,
  type CreatePulseCheckInRequest,
  type PlaceIdentity,
} from '@g88/shared';

import { MapTilerPlaceAttestationService } from './maptiler-place-attestation.service';
import { PlaceCatalogService } from './place-catalog.service';
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

const canonicalPlaceId = '11111111-1111-4111-8111-111111111111';
const oldMergedPlaceId = '22222222-2222-4222-8222-222222222222';
const userCellH3R7 = computeH3Cells(request.lat, request.lng).r7;

const placeRequest: CreatePlacePulseCheckInRequest = {
  placeId: canonicalPlaceId,
  audience: 'nearby',
  lat: request.lat,
  lng: request.lng,
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
  providerCellH3R7: userCellH3R7,
};

const attestedPlace = {
  identity: attestedIdentity,
  stableExternalRef: { namespace: 'osm' as const, externalId: 'r12345' },
};

describe('PulseCheckInService', () => {
  let query: jest.Mock;
  let publishCheckIn: jest.Mock;
  let evaluateAfterCheckIn: jest.Mock;
  let attest: jest.Mock;
  let resolvePlace: jest.Mock;
  let getActivePlace: jest.Mock;
  let service: PulseCheckInService;

  beforeEach(() => {
    query = jest.fn();
    publishCheckIn = jest.fn().mockResolvedValue(undefined);
    evaluateAfterCheckIn = jest.fn().mockResolvedValue(undefined);
    attest = jest.fn().mockResolvedValue(attestedPlace);
    resolvePlace = jest.fn().mockResolvedValue({
      id: canonicalPlaceId,
      canonicalLabel: 'Sea Garden',
      locationH3R7: attestedIdentity.providerCellH3R7,
    });
    getActivePlace = jest.fn().mockResolvedValue({
      id: canonicalPlaceId,
      canonicalLabel: 'Sea Garden',
      locationH3R7: userCellH3R7,
    });
    const realtime = { publishCheckIn } as unknown as PulseActivityRealtimeService;
    const trending = { evaluateAfterCheckIn } as unknown as PulsePlaceTrendingService;
    const placeAttestation = { attest } as unknown as MapTilerPlaceAttestationService;
    const placeCatalog = {
      resolve: resolvePlace,
      getActivePlace,
    } as unknown as PlaceCatalogService;
    service = new PulseCheckInService(
      { query } as unknown as DataSource,
      realtime,
      trending,
      placeAttestation,
      placeCatalog,
    );
  });

  it('stores a coarse user H3 cell and preserves free-text fallback without canonical identity', async () => {
    query.mockResolvedValueOnce([]).mockResolvedValueOnce([]);

    const result = await service.create('user-1', request);

    expect(result).toMatchObject({
      placeLabel: 'Sea Garden',
      placeId: null,
      placeIdentity: null,
      audience: 'friends',
    });
    const insertParams = query.mock.calls[1]?.[1] as unknown[];
    expect(insertParams).not.toContain(request.lat);
    expect(insertParams).not.toContain(request.lng);
    expect(typeof insertParams[4]).toBe('string');
    expect(insertParams.slice(5, 9)).toEqual([null, null, null, null]);
    expect(attest).not.toHaveBeenCalled();
    expect(resolvePlace).not.toHaveBeenCalled();
    expect(evaluateAfterCheckIn).not.toHaveBeenCalled();
  });

  it('persists only server-attested provider identity bound to a NEXA place ID', async () => {
    query.mockResolvedValueOnce([]).mockResolvedValueOnce([]);

    const result = await service.create('user-1', {
      ...request,
      audience: 'nearby',
      placeIdentity: clientIdentity,
    });

    expect(attest).toHaveBeenCalledWith(clientIdentity, expect.any(String));
    expect(resolvePlace).toHaveBeenCalledWith(attestedPlace);
    expect(result.placeId).toBe(canonicalPlaceId);
    expect(result.placeIdentity).toEqual(attestedIdentity);
    expect(result.placeLabel).toBe('Sea Garden');
    const insertParams = query.mock.calls[1]?.[1] as unknown[];
    expect(insertParams.slice(5, 9)).toEqual([
      'maptiler',
      'poi.12345',
      attestedIdentity.providerCellH3R7,
      canonicalPlaceId,
    ]);
    expect(evaluateAfterCheckIn).toHaveBeenCalledWith({
      placeId: canonicalPlaceId,
      canonicalLabel: 'Sea Garden',
      locationH3R7: attestedIdentity.providerCellH3R7,
      placeIdentity: attestedIdentity,
    });
  });

  it('checks in directly to a nearby canonical NEXA place without provider metadata', async () => {
    query.mockResolvedValueOnce([]).mockResolvedValueOnce([]);

    const result = await service.createForPlace('user-1', placeRequest);

    expect(getActivePlace).toHaveBeenCalledWith(canonicalPlaceId);
    expect(result).toMatchObject({
      placeLabel: 'Sea Garden',
      placeId: canonicalPlaceId,
      placeIdentity: null,
      audience: 'nearby',
    });
    const insertParams = query.mock.calls[1]?.[1] as unknown[];
    expect(insertParams).not.toContain(placeRequest.lat);
    expect(insertParams).not.toContain(placeRequest.lng);
    expect(insertParams[4]).toBe(userCellH3R7);
    expect(insertParams.slice(5, 9)).toEqual([null, null, null, canonicalPlaceId]);
    expect(evaluateAfterCheckIn).toHaveBeenCalledWith({
      placeId: canonicalPlaceId,
      canonicalLabel: 'Sea Garden',
      locationH3R7: userCellH3R7,
      placeIdentity: null,
    });
  });

  it('follows a merged place alias and persists only the active canonical place ID', async () => {
    query.mockResolvedValueOnce([]).mockResolvedValueOnce([]);
    getActivePlace.mockResolvedValueOnce({
      id: canonicalPlaceId,
      canonicalLabel: 'Sea Garden',
      locationH3R7: userCellH3R7,
    });

    const result = await service.createForPlace('user-1', {
      ...placeRequest,
      placeId: oldMergedPlaceId,
    });

    expect(getActivePlace).toHaveBeenCalledWith(oldMergedPlaceId);
    expect(result.placeId).toBe(canonicalPlaceId);
    const insertParams = query.mock.calls[1]?.[1] as unknown[];
    expect(insertParams[8]).toBe(canonicalPlaceId);
  });

  it('rejects a canonical place check-in when the current coarse location is too far away', async () => {
    query.mockResolvedValueOnce([]);
    getActivePlace.mockResolvedValueOnce({
      id: canonicalPlaceId,
      canonicalLabel: 'Far Place',
      locationH3R7: computeH3Cells(42.7, 25.3).r7,
    });

    await expect(service.createForPlace('user-1', placeRequest))
      .rejects.toMatchObject({ status: 400 });
    expect(query).toHaveBeenCalledTimes(1);
    expect(publishCheckIn).not.toHaveBeenCalled();
    expect(evaluateAfterCheckIn).not.toHaveBeenCalled();
  });

  it('fails closed when the requested NEXA place is inactive or cannot be resolved', async () => {
    query.mockResolvedValueOnce([]);
    getActivePlace.mockResolvedValueOnce(null);

    await expect(service.createForPlace('user-1', placeRequest))
      .rejects.toMatchObject({ status: 400 });
    expect(query).toHaveBeenCalledTimes(1);
    expect(publishCheckIn).not.toHaveBeenCalled();
  });

  it('does not evaluate public trends for friends-only canonical place check-ins', async () => {
    query.mockResolvedValueOnce([]).mockResolvedValueOnce([]);
    await service.createForPlace('user-1', { ...placeRequest, audience: 'friends' });
    expect(evaluateAfterCheckIn).not.toHaveBeenCalled();
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

    expect(result.placeId).toBeNull();
    expect(result.placeIdentity).toBeNull();
    expect(result.placeLabel).toBe('My custom Sea Garden label');
    const insertParams = query.mock.calls[1]?.[1] as unknown[];
    expect(insertParams.slice(5, 9)).toEqual([null, null, null, null]);
    expect(resolvePlace).not.toHaveBeenCalled();
    expect(evaluateAfterCheckIn).not.toHaveBeenCalled();
  });

  it('fails soft when catalog reconciliation cannot safely resolve a place', async () => {
    query.mockResolvedValueOnce([]).mockResolvedValueOnce([]);
    resolvePlace.mockRejectedValueOnce(new Error('conflicting external place references'));

    const result = await service.create('user-1', {
      ...request,
      audience: 'nearby',
      placeLabel: 'Fallback label',
      placeIdentity: clientIdentity,
    });

    expect(result).toMatchObject({ placeLabel: 'Fallback label', placeId: null, placeIdentity: null });
    const insertParams = query.mock.calls[1]?.[1] as unknown[];
    expect(insertParams.slice(5, 9)).toEqual([null, null, null, null]);
    expect(evaluateAfterCheckIn).not.toHaveBeenCalled();
  });

  it('rejects another check-in during the cooldown window before provider or place resolution', async () => {
    query.mockResolvedValueOnce([{ id: 'recent-check-in' }]);
    await expect(service.createForPlace('user-1', placeRequest)).rejects.toMatchObject({ status: 429 });
    expect(query).toHaveBeenCalledTimes(1);
    expect(getActivePlace).not.toHaveBeenCalled();
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
    await expect(service.create('user-1', request)).resolves.toMatchObject({
      placeLabel: 'Sea Garden',
      placeId: null,
    });
  });
});
