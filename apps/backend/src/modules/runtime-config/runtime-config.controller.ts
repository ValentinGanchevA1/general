import { Controller, Get, Header } from '@nestjs/common';
import {
  MAP_RENDERER_POLICY_CACHE_TTL_SECONDS,
  MAP_RENDERER_POLICY_VERSION,
  type MapRendererPolicyDto,
} from '@g88/shared';

/**
 * Fail-closed server-side renderer switch.
 *
 * Only the exact string "true" enables MapLibre. Missing values, whitespace,
 * alternate casing, numeric truthy values, and malformed values all resolve to
 * disabled so an operational mistake cannot accidentally widen rollout.
 */
export function resolveMapLibreRemoteEnabled(value: string | undefined): boolean {
  return value === 'true';
}

@Controller('runtime-config')
export class RuntimeConfigController {
  @Get('map-renderer')
  @Header('Cache-Control', 'no-store')
  getMapRendererPolicy(): MapRendererPolicyDto {
    return {
      version: MAP_RENDERER_POLICY_VERSION,
      mapLibreEnabled: resolveMapLibreRemoteEnabled(
        process.env.NEXA_MAPLIBRE_REMOTE_ENABLED,
      ),
      cacheTtlSeconds: MAP_RENDERER_POLICY_CACHE_TTL_SECONDS,
    };
  }
}
