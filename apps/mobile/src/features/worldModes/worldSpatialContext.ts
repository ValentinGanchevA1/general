import type { WorldModeId } from '@/features/worldModes/worldModes';
import type { NexaSpatialLens } from '@/features/map/nexaSpatialLens.store';

/**
 * Worlds Expansion W2-2: opt-in spatial context mapping.
 *
 * This is a suggestion contract only. Callers must not mutate the current lens
 * automatically: user intent, viewport, selected entity and filter state stay
 * authoritative. Worlds without a spatial mapping remain presentation-only.
 */
export type WorldSpatialContext = Readonly<{
  lens: Extract<NexaSpatialLens, 'experiences' | 'opportunities'>;
  reason: 'world-focus';
}>;

const WORLD_SPATIAL_CONTEXTS: Partial<Record<WorldModeId, WorldSpatialContext>> = {
  pathfinder: { lens: 'experiences', reason: 'world-focus' },
  bazaar: { lens: 'opportunities', reason: 'world-focus' },
  nocturne: { lens: 'experiences', reason: 'world-focus' },
};

/** Returns a spatial context suggestion; never changes map state or access. */
export function resolveWorldSpatialContext(id: WorldModeId): WorldSpatialContext | null {
  return WORLD_SPATIAL_CONTEXTS[id] ?? null;
}
