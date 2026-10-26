export const MAP_RENDERER_POLICY_VERSION = 1 as const;
export const MAP_RENDERER_POLICY_CACHE_TTL_SECONDS = 60;

/**
 * Public, read-only runtime policy consumed by mobile clients before enabling
 * the MapLibre renderer. The client must fail closed to legacy when this
 * contract is missing, malformed, stale, or unavailable.
 */
export interface MapRendererPolicyDto {
  version: typeof MAP_RENDERER_POLICY_VERSION;
  mapLibreEnabled: boolean;
  cacheTtlSeconds: number;
}
