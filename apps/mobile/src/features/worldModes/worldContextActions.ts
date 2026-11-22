import type { WorldModeId } from '@/features/worldModes/worldModes';

/**
 * W2-4: contextual action affordances are labels, not executable permissions.
 * Callers must re-check authorization, visibility, verification, safety and
 * entity state in the authoritative feature/backend before performing actions.
 */
export type WorldContextAction = Readonly<{
  id: 'view-event' | 'save-place' | 'view-listing' | 'create-event' | 'join-community' | 'view-challenge' | 'view-invitation';
  label: string;
}>;

const ACTIONS: Partial<Record<WorldModeId, readonly WorldContextAction[]>> = {
  pathfinder: [{ id: 'save-place', label: 'Save destination' }, { id: 'view-event', label: 'Explore experience' }],
  nocturne: [{ id: 'view-event', label: 'Explore event' }, { id: 'save-place', label: 'Save venue' }],
  bazaar: [{ id: 'view-listing', label: 'View listing' }],
  architect: [{ id: 'create-event', label: 'Create event' }, { id: 'join-community', label: 'Organize with community' }],
  diplomat: [{ id: 'view-invitation', label: 'View invitation' }, { id: 'join-community', label: 'Explore community' }],
  vanguard: [{ id: 'view-challenge', label: 'View challenge' }],
  sanctuary: [{ id: 'save-place', label: 'Save calm place' }],
};

export function resolveWorldContextActions(id: WorldModeId): readonly WorldContextAction[] {
  return ACTIONS[id] ?? [];
}
