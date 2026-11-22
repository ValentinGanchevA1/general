import type { WorldModeId } from '@/features/worldModes/worldModes';
import type { NexaSpatialLens } from '@/features/map/nexaSpatialLens.store';

/** W2-3 hints only: no query, permissions, ranking overrides or backend filters. */
export type WorldDiscoveryPreset = Readonly<{
  worldId: WorldModeId;
  lens: Extract<NexaSpatialLens, 'experiences' | 'opportunities' | 'map'>;
  label: string;
  emphasis: readonly string[];
}>;

const PRESETS: Partial<Record<WorldModeId, WorldDiscoveryPreset>> = {
  pathfinder: { worldId: 'pathfinder', lens: 'experiences', label: 'Places & experiences', emphasis: ['places', 'routes', 'saved-destinations'] },
  nocturne: { worldId: 'nocturne', lens: 'experiences', label: 'Evening discovery', emphasis: ['events', 'music', 'venues'] },
  bazaar: { worldId: 'bazaar', lens: 'opportunities', label: 'Local marketplace', emphasis: ['listings', 'offers', 'local-trade'] },
  architect: { worldId: 'architect', lens: 'map', label: 'Create & organize', emphasis: ['events', 'communities', 'collaboration'] },
  diplomat: { worldId: 'diplomat', lens: 'map', label: 'Communities & invitations', emphasis: ['communities', 'invitations', 'connections'] },
  vanguard: { worldId: 'vanguard', lens: 'map', label: 'Challenges & progress', emphasis: ['challenges', 'achievements', 'progress'] },
  sanctuary: { worldId: 'sanctuary', lens: 'map', label: 'Calm discovery', emphasis: ['quiet-places', 'wellbeing', 'low-stimulation'] },
};

/** Read-only suggestion. Consumers must not auto-apply filters or permissions. */
export function resolveWorldDiscoveryPreset(id: WorldModeId): WorldDiscoveryPreset | null {
  return PRESETS[id] ?? null;
}
