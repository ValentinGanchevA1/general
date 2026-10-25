import {
  mapRendererRolloutPolicy,
  NEXA_MAP_RENDERER_ROLLOUT,
} from '../mapRendererRollout';

describe('map renderer rollout policy', () => {
  it('ships with the proven legacy renderer and MapLibre unavailable', () => {
    expect(NEXA_MAP_RENDERER_ROLLOUT).toEqual({
      requestedRenderer: 'legacy',
      mapLibreAvailable: false,
    });
  });

  it('supports an explicit renderer request without implying native availability', () => {
    expect(
      mapRendererRolloutPolicy({ requestedRenderer: 'maplibre' }),
    ).toEqual({
      requestedRenderer: 'maplibre',
      mapLibreAvailable: false,
    });
  });

  it('requires availability to be enabled independently', () => {
    expect(
      mapRendererRolloutPolicy({ mapLibreAvailable: true }),
    ).toEqual({
      requestedRenderer: 'legacy',
      mapLibreAvailable: true,
    });
  });

  it('allows the validated MapLibre rollout state only when both switches are explicit', () => {
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
