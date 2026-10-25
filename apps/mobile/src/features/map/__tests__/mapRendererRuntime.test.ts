import { resolveAvailableMapRenderer } from '../mapRendererRuntime';

describe('resolveAvailableMapRenderer', () => {
  it('keeps the legacy renderer when legacy is requested', () => {
    expect(resolveAvailableMapRenderer({ requested: 'legacy', mapLibreAvailable: false })).toBe('legacy');
  });

  it('fails safely to legacy when MapLibre is requested but unavailable', () => {
    expect(resolveAvailableMapRenderer({ requested: 'maplibre', mapLibreAvailable: false })).toBe('legacy');
  });

  it('allows MapLibre only when it is explicitly requested and available', () => {
    expect(resolveAvailableMapRenderer({ requested: 'maplibre', mapLibreAvailable: true })).toBe('maplibre');
  });

  it('does not switch to MapLibre merely because it is available', () => {
    expect(resolveAvailableMapRenderer({ requested: 'legacy', mapLibreAvailable: true })).toBe('legacy');
  });
});
