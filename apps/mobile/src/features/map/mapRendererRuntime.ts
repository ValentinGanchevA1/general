import type { MapRendererKind } from './mapRenderer';

export interface MapRendererRuntimeOptions {
  requested: MapRendererKind;
  mapLibreAvailable: boolean;
}

/**
 * Runtime safety gate for renderer rollout.
 *
 * A remote/config flag may request MapLibre, but production must keep the
 * proven legacy renderer until the native MapLibre implementation is actually
 * bundled and parity-validated. This makes an accidental flag flip a safe
 * fallback rather than a blank or crashing map.
 */
export function resolveAvailableMapRenderer({
  requested,
  mapLibreAvailable,
}: MapRendererRuntimeOptions): MapRendererKind {
  if (requested === 'maplibre' && mapLibreAvailable) return 'maplibre';
  return 'legacy';
}
