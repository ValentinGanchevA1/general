import { computeH3Cells, type PlaceIdentity } from '@g88/shared';

import { MapTilerPlaceAttestationService } from './maptiler-place-attestation.service';

const userLat = 43.2047;
const userLng = 27.9105;
const userCell = computeH3Cells(userLat, userLng).r7;

const clientIdentity: PlaceIdentity = {
  provider: 'maptiler',
  providerPlaceId: 'poi.12345',
  canonicalLabel: 'Forged client label',
  providerCellH3R7: computeH3Cells(42.6977, 23.3219).r7,
};

function responseWith(body: unknown, status = 200, headers?: Record<string, string>): Response {
  return {
    ok: status >= 200 && status < 300,
    status,
    headers: new Headers(headers),
    text: jest.fn().mockResolvedValue(JSON.stringify(body)),
  } as unknown as Response;
}

describe('MapTilerPlaceAttestationService', () => {
  const originalServerKey = process.env.NEXA_MAPTILER_SERVER_API_KEY;
  const originalRegion = process.env.NEXA_MAPTILER_REGION;
  let fetchSpy: jest.SpiedFunction<typeof fetch>;
  let service: MapTilerPlaceAttestationService;

  beforeEach(() => {
    process.env.NEXA_MAPTILER_SERVER_API_KEY = 'server-key';
    process.env.NEXA_MAPTILER_REGION = 'eu';
    fetchSpy = jest.spyOn(globalThis, 'fetch');
    service = new MapTilerPlaceAttestationService();
  });

  afterEach(() => {
    fetchSpy.mockRestore();
    if (originalServerKey === undefined) delete process.env.NEXA_MAPTILER_SERVER_API_KEY;
    else process.env.NEXA_MAPTILER_SERVER_API_KEY = originalServerKey;
    if (originalRegion === undefined) delete process.env.NEXA_MAPTILER_REGION;
    else process.env.NEXA_MAPTILER_REGION = originalRegion;
  });

  it('resolves the feature by ID and derives canonical label and coarse H3 only from provider data', async () => {
    fetchSpy.mockResolvedValueOnce(responseWith({
      type: 'FeatureCollection',
      features: [{
        id: 'poi.12345',
        text: 'Sea Garden',
        center: [userLng, userLat],
      }],
    }));

    const result = await service.attest(clientIdentity, userCell);

    expect(result).toEqual({
      provider: 'maptiler',
      providerPlaceId: 'poi.12345',
      canonicalLabel: 'Sea Garden',
      providerCellH3R7: userCell,
    });
    const [url, init] = fetchSpy.mock.calls[0] ?? [];
    expect(String(url)).toContain('https://api.maptiler.eu/geocoding/poi.12345.json');
    expect(String(url)).toContain('key=server-key');
    expect(String(url)).not.toContain(String(userLat));
    expect(String(url)).not.toContain(String(userLng));
    expect(init).toEqual(expect.objectContaining({ method: 'GET', redirect: 'error' }));
  });

  it('uses the global MapTiler origin only when configured', async () => {
    process.env.NEXA_MAPTILER_REGION = 'global';
    fetchSpy.mockResolvedValueOnce(responseWith({ features: [] }));

    await service.attest(clientIdentity, userCell);

    expect(String(fetchSpy.mock.calls[0]?.[0])).toContain('https://api.maptiler.com/');
  });

  it('does not call the provider when the server key is missing', async () => {
    delete process.env.NEXA_MAPTILER_SERVER_API_KEY;

    await expect(service.attest(clientIdentity, userCell)).resolves.toBeNull();
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it('rejects malformed or stale feature IDs without promoting them to canonical places', async () => {
    await expect(service.attest({
      ...clientIdentity,
      providerPlaceId: 'poi.not-a-number',
    }, userCell)).resolves.toBeNull();
    expect(fetchSpy).not.toHaveBeenCalled();

    fetchSpy.mockResolvedValueOnce(responseWith({ features: [] }, 404));
    await expect(service.attest(clientIdentity, userCell)).resolves.toBeNull();
  });

  it('fails soft when the provider is unavailable', async () => {
    fetchSpy.mockRejectedValueOnce(new Error('provider unavailable'));

    await expect(service.attest(clientIdentity, userCell)).resolves.toBeNull();
  });

  it('rejects a provider-resolved feature outside the allowed coarse area', async () => {
    fetchSpy.mockResolvedValueOnce(responseWith({
      features: [{
        id: 'poi.12345',
        text: 'Far away venue',
        center: [23.3219, 42.6977],
      }],
    }));

    await expect(service.attest(clientIdentity, userCell)).resolves.toBeNull();
  });

  it('requires the returned feature ID to exactly match the requested ID', async () => {
    fetchSpy.mockResolvedValueOnce(responseWith({
      features: [{
        id: 'poi.67890',
        text: 'Different place',
        center: [userLng, userLat],
      }],
    }));

    await expect(service.attest(clientIdentity, userCell)).resolves.toBeNull();
  });

  it('rejects oversized provider responses before JSON parsing', async () => {
    fetchSpy.mockResolvedValueOnce(responseWith(
      { features: [] },
      200,
      { 'content-length': String(300 * 1024) },
    ));

    await expect(service.attest(clientIdentity, userCell)).resolves.toBeNull();
  });
});
