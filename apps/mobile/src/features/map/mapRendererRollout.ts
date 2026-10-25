import type { MapRendererKind } from './mapRenderer';

export interface MapRendererRolloutPolicy {
  requestedRenderer: MapRendererKind;
  mapLibreAvailable: boolean;
}

/**
 * Production-safe rollout policy for the map renderer boundary.
 *
 * Keep both switches false/legacy until the MapLibre native bundle has passed
 * camera, viewport, discovery, selection, and Android/iOS parity validation.
 * Separating request from availability prevents a remote/config request from
 * loading a renderer that is not actually bundled in the binary.
 */
export const NEXA_MAP_RENDERER_ROLLOUT: Readonly<MapRendererRolloutPolicy> = {
  requestedRenderer: 'legacy',
  mapLibreAvailable: false,
};

export function mapRendererRolloutPolicy(
  overrides: Partial<MapRendererRolloutPolicy> = {},
): MapRendererRolloutPolicy {
  return {
    ...NEXA_MAP_RENDERER_ROLLOUT,
    ...overrides,
  };
}
