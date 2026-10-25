import {
  MAP_RENDERER_CAPABILITIES,
  resolveMapRenderer,
} from '../mapRenderer';

describe('map renderer rollout policy', () => {
  it('keeps the legacy renderer as the safe default', () => {
    expect(resolveMapRenderer(false)).toBe('legacy');
  });

  it('selects MapLibre only when explicitly enabled', () => {
    expect(resolveMapRenderer(true)).toBe('maplibre');
  });

  it('keeps server-authoritative clustering for both renderers', () => {
    expect(MAP_RENDERER_CAPABILITIES.legacy.serverAuthoritativeClustering).toBe(true);
    expect(MAP_RENDERER_CAPABILITIES.maplibre.serverAuthoritativeClustering).toBe(true);
  });

  it('reserves native discovery layers and feature-state for MapLibre', () => {
    expect(MAP_RENDERER_CAPABILITIES.legacy.nativeDiscoveryLayers).toBe(false);
    expect(MAP_RENDERER_CAPABILITIES.legacy.featureStateSelection).toBe(false);
    expect(MAP_RENDERER_CAPABILITIES.maplibre.nativeDiscoveryLayers).toBe(true);
    expect(MAP_RENDERER_CAPABILITIES.maplibre.featureStateSelection).toBe(true);
  });
});
