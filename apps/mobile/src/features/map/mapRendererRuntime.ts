import type { MapRendererKind } from './mapRenderer';

export interface MapRendererRuntimeOptions {
  requested: MapRendererKind;
  mapLibreAvailable: boolean;
  mapLibreConfigured: boolean;
}

/**
 * Runtime safety gate for renderer rollout.
 *
 * MapLibre can render only when product requests it, the native implementation
 * is bundled, and the production provider/style configuration is valid. Any
 * missing gate fails closed to the proven legacy renderer.
 */
export function resolveAvailableMapRenderer({
  requested,
  mapLibreAvailable,
  mapLibreConfigured,
}: MapRendererRuntimeOptions): MapRendererKind {
  if (
    requested === 'maplibre' &&
    mapLibreAvailable &&
    mapLibreConfigured
  ) {
    return 'maplibre';
  }
  return 'legacy';
}
