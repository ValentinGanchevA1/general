import type { WorldModeId } from '@/features/worldModes/worldModes';
import { resolveWorldContextActions } from './worldContextActions';
import { resolveWorldDiscoveryPreset } from './worldDiscoveryPresets';
import { resolveWorldSpatialContext } from './worldSpatialContext';

/**
 * W2-7: read-only aggregate contract for map surfaces.
 * Suggestions and affordances are display-only; this resolver never changes
 * lens, query, ranking, authorization, permissions, location sharing or routes.
 */
export type WorldMapContext = Readonly<{
  worldId: WorldModeId;
  discoveryPreset: ReturnType<typeof resolveWorldDiscoveryPreset>;
  spatialSuggestion: ReturnType<typeof resolveWorldSpatialContext>;
  actions: ReturnType<typeof resolveWorldContextActions>;
}>;

export function resolveWorldMapContext(worldId: WorldModeId): WorldMapContext {
  return {
    worldId,
    discoveryPreset: resolveWorldDiscoveryPreset(worldId),
    spatialSuggestion: resolveWorldSpatialContext(worldId),
    actions: resolveWorldContextActions(worldId),
  };
}
