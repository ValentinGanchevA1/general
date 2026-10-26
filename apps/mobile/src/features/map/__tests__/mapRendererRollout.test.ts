import {
  mapRendererRolloutPolicy,
  NEXA_MAP_RENDERER_ROLLOUT,
} from '../mapRendererRollout';

describe('map renderer rollout policy', () => {
  it('ships with the proven legacy renderer while the native MapLibre bundle is available', () => {
    expect(NEXA_MAP_RENDERER_ROLLOUT).toEqual({
      requestedRenderer: 'legacy',
      mapLibreAvailable: true,
    });
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
      requestedRenderer: 'legacy',
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
