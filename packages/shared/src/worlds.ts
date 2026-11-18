/** Shared, platform-neutral MANY WORLDS contracts for Web, Android and iOS. */
export const WORLD_IDS = [
  'nexus', 'noir', 'profiler', 'pathfinder', 'nocturne',
  'diplomat', 'architect', 'bazaar', 'vanguard', 'sanctuary',
] as const;

export type WorldId = (typeof WORLD_IDS)[number];
export type WorldStatus = 'available' | 'preview' | 'disabled';
export type WorldCapability =
  | 'people.discover'
  | 'events.discover'
  | 'pulse.read'
  | 'profiles.view'
  | 'routes.explore'
  | 'communities.discover'
  | 'spaces.create'
  | 'listings.discover'
  | 'challenges.view'
  | 'circles.view';

export interface WorldDefinition {
  readonly id: WorldId;
  readonly displayName: string;
  readonly status: WorldStatus;
  readonly capabilities: readonly WorldCapability[];
  readonly themeKey: string;
}

export const WORLD_DEFINITIONS: Readonly<Record<WorldId, WorldDefinition>> = {
  nexus: { id: 'nexus', displayName: 'NEXUS', status: 'available', capabilities: ['people.discover', 'events.discover', 'pulse.read'], themeKey: 'nexus' },
  noir: { id: 'noir', displayName: 'NOIR', status: 'preview', capabilities: ['events.discover'], themeKey: 'noir' },
  profiler: { id: 'profiler', displayName: 'PROFILER', status: 'preview', capabilities: ['profiles.view'], themeKey: 'profiler' },
  pathfinder: { id: 'pathfinder', displayName: 'PATHFINDER', status: 'preview', capabilities: ['routes.explore'], themeKey: 'pathfinder' },
  nocturne: { id: 'nocturne', displayName: 'NOCTURNE', status: 'preview', capabilities: ['events.discover'], themeKey: 'nocturne' },
  diplomat: { id: 'diplomat', displayName: 'DIPLOMAT', status: 'preview', capabilities: ['communities.discover'], themeKey: 'diplomat' },
  architect: { id: 'architect', displayName: 'ARCHITECT', status: 'preview', capabilities: ['spaces.create'], themeKey: 'architect' },
  bazaar: { id: 'bazaar', displayName: 'BAZAAR', status: 'preview', capabilities: ['listings.discover'], themeKey: 'bazaar' },
  vanguard: { id: 'vanguard', displayName: 'VANGUARD', status: 'preview', capabilities: ['challenges.view'], themeKey: 'vanguard' },
  sanctuary: { id: 'sanctuary', displayName: 'SANCTUARY', status: 'preview', capabilities: ['circles.view'], themeKey: 'sanctuary' },
};

export interface WorldViewport {
  readonly north: number;
  readonly south: number;
  readonly east: number;
  readonly west: number;
}

export interface WorldDiscoveryRequest {
  readonly worldId: WorldId;
  readonly viewport: WorldViewport;
  readonly filters?: Readonly<Record<string, readonly string[]>>;
}

export interface WorldFeatureFlags {
  readonly manyWorldsEnabled: boolean;
  readonly enabledWorlds: readonly WorldId[];
}

/** UI availability only; backend authorization must always be enforced separately. */
export function isWorldEnabled(worldId: WorldId, flags: WorldFeatureFlags): boolean {
  return flags.manyWorldsEnabled &&
    WORLD_DEFINITIONS[worldId].status !== 'disabled' &&
    flags.enabledWorlds.includes(worldId);
}
