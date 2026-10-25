export type MapRendererKind = 'legacy' | 'maplibre';

export interface MapRendererCapabilities {
  nativeDiscoveryLayers: boolean;
  featureStateSelection: boolean;
  serverAuthoritativeClustering: boolean;
}

export const MAP_RENDERER_CAPABILITIES: Readonly<Record<MapRendererKind, MapRendererCapabilities>> = {
  legacy: {
    nativeDiscoveryLayers: false,
    featureStateSelection: false,
    serverAuthoritativeClustering: true,
  },
  maplibre: {
    nativeDiscoveryLayers: true,
    featureStateSelection: true,
    serverAuthoritativeClustering: true,
  },
};

/**
 * Runtime selection is intentionally explicit. Do not infer renderer choice
 * from platform, device model, discovery density, or remote map data.
 *
 * Until MapLibre parity is proven, production defaults to the legacy renderer.
 */
export function resolveMapRenderer(mapLibreEnabled: boolean): MapRendererKind {
  return mapLibreEnabled ? 'maplibre' : 'legacy';
}
