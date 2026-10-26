import {
  mapRendererRolloutPolicy,
  NEXA_MAP_RENDERER_ROLLOUT,
  resolveRequestedMapRenderer,
} from '../mapRendererRollout';

describe('map renderer rollout policy', () => {
  it('fails closed to legacy unless MapLibre is explicitly requested', () => {
    expect(resolveRequestedMapRenderer(undefined)).toBe('legacy');
    expect(resolveRequestedMapRenderer('')).toBe('legacy');
    expect(resolveRequestedMapRenderer('legacy')).toBe('legacy');
    expect(resolveRequestedMapRenderer('MAPLIBRE')).toBe('legacy');
    expect(resolveRequestedMapRenderer(' maplibre ')).toBe('legacy');
    expect(resolveRequestedMapRenderer('unexpected')).toBe('legacy');
  });

  it('accepts only the exact MapLibre opt-in value', () => {
    expect(resolveRequestedMapRenderer('maplibre')).toBe('maplibre');
  });

  it('keeps native MapLibre availability independent from the requested renderer', () => {
    expect(NEXA_MAP_RENDERER_ROLLOUT.mapLibreAvailable).toBe(true);
  });

  it('can request MapLibre without changing the independently declared availability', () => {
    expect(
      mapRendererRolloutPolicy({ requestedRenderer: 'maplibre' }),
    ).toEqual({
      requestedRenderer: 'maplibre',
      mapLibreAvailable: true,
    });
  });

  it('can fail closed by disabling native availability independently', () => {
    expect(
      mapRendererRolloutPolicy({ mapLibreAvailable: false }),
    ).toEqual({
      requestedRenderer: NEXA_MAP_RENDERER_ROLLOUT.requestedRenderer,
      mapLibreAvailable: false,
    });
  });

  it('allows the validated MapLibre rollout state only when both switches are enabled', () => {
    expect(
      mapRendererRolloutPolicy({
        requestedRenderer: 'maplibre',
        mapLibreAvailable: true,
      }),
    ).toEqual({
      requestedRenderer: 'maplibre',
      mapLibreAvailable: true,
    });
  });
});
