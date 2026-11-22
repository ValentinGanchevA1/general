import type { WorldModeId } from './worldModes';

const WORLD_SEARCH_PLACEHOLDERS: Partial<Record<WorldModeId, string>> = {
  pathfinder: 'Search places',
  nocturne: 'Search events and venues',
  bazaar: 'Search listings',
  architect: 'Search events',
  diplomat: 'Search communities',
  vanguard: 'Search challenges',
  sanctuary: 'Search calm places',
};

/** Copy-only hint: does not apply a lens, filter, query or access policy. */
export function resolveWorldSearchPlaceholder(id: WorldModeId | null): string {
  return id == null ? 'Search nearby' : WORLD_SEARCH_PLACEHOLDERS[id] ?? 'Search nearby';
}
