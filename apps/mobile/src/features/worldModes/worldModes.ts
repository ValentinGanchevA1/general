import type { WorldModePaletteId } from '@/theme/worldModePalettes';

export const WORLD_MODE_IDS = [
  'nexus', 'noir', 'profiler', 'pathfinder', 'nocturne',
  'diplomat', 'architect', 'bazaar', 'vanguard', 'sanctuary',
] as const satisfies readonly WorldModePaletteId[];

export type WorldModeId = (typeof WORLD_MODE_IDS)[number];
export type WorldModeCategory = 'social' | 'explore' | 'create' | 'lifestyle';
export type WorldModeConfig = Readonly<{
  id: WorldModeId;
  label: string;
  subtitle: string;
  description: string;
  category: WorldModeCategory;
  symbol: string;
  highlights: readonly [string, string, string];
}>;

/**
 * Pre-release gate: selector is visible on development builds only.
 * Do not enable in production until Android/iOS a11y + persistence QA passes.
 */
export const WORLD_MODES_ENABLED = __DEV__;

/** No capabilities or permissions live in this manifest. */
export const WORLD_MODES: Readonly<Record<WorldModeId, WorldModeConfig>> = {
  nexus: {
    id: 'nexus', label: 'Nexus', subtitle: 'The connected world',
    description: 'An all-in-one perspective on people, places and live moments.',
    category: 'social', symbol: '◇',
    highlights: ['Nearby discoveries', 'Live local activity', 'Meaningful connections'],
  },
  noir: {
    id: 'noir', label: 'Noir', subtitle: 'Focus in the shadows',
    description: 'A quieter, high-contrast interface for focused exploration.',
    category: 'lifestyle', symbol: '◐',
    highlights: ['Minimal surfaces', 'Clear map overlays', 'Reduced visual noise'],
  },
  profiler: {
    id: 'profiler', label: 'Profiler', subtitle: 'Identity and insights',
    description: 'Explore your own identity and the interests you choose to share.',
    category: 'social', symbol: '◎',
    highlights: ['Own profile', 'Shared interests', 'Trust transparency'],
  },
  pathfinder: {
    id: 'pathfinder', label: 'Pathfinder', subtitle: 'Explore beyond',
    description: 'Put places, routes and local experiences in the spotlight.',
    category: 'explore', symbol: '⌖',
    highlights: ['Places nearby', 'Saved destinations', 'Route inspiration'],
  },
  nocturne: {
    id: 'nocturne', label: 'Nocturne', subtitle: 'After dark',
    description: 'Discover the energy of live events and evening destinations.',
    category: 'explore', symbol: '☾',
    highlights: ['Evening events', 'Music and venues', 'Night-time discovery'],
  },
  diplomat: {
    id: 'diplomat', label: 'Diplomat', subtitle: 'Better connections',
    description: 'A refined view of conversations, invitations and communities.',
    category: 'social', symbol: '✧',
    highlights: ['Curated conversations', 'Invitations', 'Trusted communities'],
  },
  architect: {
    id: 'architect', label: 'Architect', subtitle: 'Create and organize',
    description: 'Focus on building events, communities and shared experiences.',
    category: 'create', symbol: '⬡',
    highlights: ['Create an event', 'Manage gatherings', 'Collaborate'],
  },
  bazaar: {
    id: 'bazaar', label: 'Bazaar', subtitle: 'The local marketplace',
    description: 'Explore nearby listings, local opportunities and offers.',
    category: 'create', symbol: '▣',
    highlights: ['Nearby listings', 'Local offers', 'Secure interactions'],
  },
  vanguard: {
    id: 'vanguard', label: 'Vanguard', subtitle: 'Challenges and progress',
    description: 'See your challenges, achievements and milestones at a glance.',
    category: 'lifestyle', symbol: '✦',
    highlights: ['Challenges', 'Achievements', 'XP and progress'],
  },
  sanctuary: {
    id: 'sanctuary', label: 'Sanctuary', subtitle: 'A calmer perspective',
    description: 'A soft, low-stimulation visual space for intentional discovery.',
    category: 'lifestyle', symbol: '❀',
    highlights: ['Gentle visuals', 'Places to unwind', 'Privacy stays yours'],
  },
};

export function isWorldModeId(value: unknown): value is WorldModeId {
  return typeof value === 'string' &&
    (WORLD_MODE_IDS as readonly string[]).includes(value);
}