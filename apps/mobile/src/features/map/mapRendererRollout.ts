import type { MapRendererKind } from './mapRenderer';

export interface MapRendererRolloutPolicy {
  requestedRenderer: MapRendererKind;
  mapLibreAvailable: boolean;
}

/**
 * Production-safe rollout policy for the map renderer boundary.
 *
 * The native MapLibre implementation is bundled and available in the mobile
 * binary, but product traffic remains on the proven legacy renderer until the
 * production style/provider path and Android/iOS parity gates are complete.
 * Availability declares binary capability only; it does not activate MapLibre.
 */
export const NEXA_MAP_RENDERER_ROLLOUT: Readonly<MapRendererRolloutPolicy> = {
  requestedRenderer: 'legacy',
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
