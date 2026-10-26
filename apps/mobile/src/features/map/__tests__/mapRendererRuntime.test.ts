import { resolveAvailableMapRenderer } from '../mapRendererRuntime';

describe('resolveAvailableMapRenderer', () => {
  it('keeps the legacy renderer when legacy is requested', () => {
    expect(
      resolveAvailableMapRenderer({
        requested: 'legacy',
        mapLibreAvailable: true,
        mapLibreConfigured: true,
      }),
    ).toBe('legacy');
  });

  it('fails safely to legacy when MapLibre is requested but unavailable', () => {
    expect(
      resolveAvailableMapRenderer({
        requested: 'maplibre',
        mapLibreAvailable: false,
        mapLibreConfigured: true,
      }),
    ).toBe('legacy');
  });

  it('fails safely to legacy when MapLibre provider config is missing', () => {
    expect(
      resolveAvailableMapRenderer({
        requested: 'maplibre',
        mapLibreAvailable: true,
        mapLibreConfigured: false,
      }),
    ).toBe('legacy');
  });

  it('allows MapLibre only when requested, available, and configured', () => {
    expect(
      resolveAvailableMapRenderer({
        requested: 'maplibre',
        mapLibreAvailable: true,
        mapLibreConfigured: true,
      }),
    ).toBe('maplibre');
  });

  it('does not switch to MapLibre merely because it is available and configured', () => {
    expect(
      resolveAvailableMapRenderer({
        requested: 'legacy',
        mapLibreAvailable: true,
        mapLibreConfigured: true,
      }),
    ).toBe('legacy');
  });
});
