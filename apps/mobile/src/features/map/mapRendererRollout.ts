import { Config } from '@/config';
import type { MapRendererKind } from './mapRenderer';

export interface MapRendererRolloutPolicy {
  requestedRenderer: MapRendererKind;
  mapLibreAvailable: boolean;
}

/**
 * Resolve the build-time renderer request with a fail-closed contract.
 *
 * Only the exact value "maplibre" opts into the native renderer. Missing,
 * malformed, differently-cased, or whitespace-padded values remain on legacy.
 */
export function resolveRequestedMapRenderer(
  value: string | undefined,
): MapRendererKind {
  return value === 'maplibre' ? 'maplibre' : 'legacy';
}

/**
 * The server permission is an additional production gate, never an override.
 * A legacy build cannot be remotely promoted to MapLibre, and an unavailable
 * remote policy always resolves to legacy.
 */
export function resolveRemoteMapRendererRequest(
  buildRequestedRenderer: MapRendererKind,
  remoteMapLibreEnabled: boolean,
): MapRendererKind {
  return buildRequestedRenderer === 'maplibre' && remoteMapLibreEnabled
    ? 'maplibre'
    : 'legacy';
}

/**
 * Production-safe rollout policy for the map renderer boundary.
 *
 * The native MapLibre implementation is bundled and available in the mobile
 * binary. Product traffic remains on legacy unless the build explicitly opts in
 * with NEXA_MAP_RENDERER=maplibre. Availability declares binary capability only;
 * it does not activate MapLibre by itself. Production MapLibre additionally
 * requires the runtime server policy to allow it.
 */
export const NEXA_MAP_RENDERER_ROLLOUT: Readonly<MapRendererRolloutPolicy> = {
  requestedRenderer: resolveRequestedMapRenderer(Config.MAP_RENDERER_REQUESTED),
  mapLibreAvailable: true,
};

export function mapRendererRolloutPolicy(
  overrides: Partial<MapRendererRolloutPolicy> = {},
): MapRendererRolloutPolicy {
  return {
    ...NEXA_MAP_RENDERER_ROLLOUT,
    ...overrides,
  };
}
