import { WORLD_DEFINITIONS, WORLD_IDS, type WorldId } from '../../packages/shared/src/worlds';

const WORLD_FLAG = 'manyWorlds';
const WORLD_QUERY = 'world';

export function manyWorldsPreviewEnabled(search: string): boolean {
  return new URLSearchParams(search).get(WORLD_FLAG) === '1';
}

export function worldFromSearch(search: string): WorldId {
  const params = new URLSearchParams(search);
  const value = params.get(WORLD_QUERY);
  return WORLD_IDS.find((id) => id === value) ?? 'nexus';
}

export function worldPickerMarkup(active: WorldId): string {
  const options = WORLD_IDS.map((id) => {
    const definition = WORLD_DEFINITIONS[id];
    const selected = id === active ? ' selected' : '';
    const suffix = definition.status === 'preview' ? ' · Preview' : '';
    return `<button type="button" class="world-choice${selected}" data-world="${id}" aria-current="${id === active ? 'true' : 'false'}">${definition.displayName}${suffix}</button>`;
  }).join('');
  return `<section class="world-switcher" aria-label="Many Worlds preview"><strong>MANY WORLDS</strong><div class="world-choices">${options}</div></section>`;
}

/** Preview-only navigation. No world-specific API authorization or discovery implied. */
export function worldUrl(id: WorldId, location: Location): string {
  const url = new URL(location.href);
  url.searchParams.set(WORLD_FLAG, '1');
  url.searchParams.set(WORLD_QUERY, id);
  return `${url.pathname}${url.search}${url.hash}`;
}

/** Visual-only world themes. Not capabilities, permissions or user segmentation. */
export interface WorldVisual {
  readonly glyph: string;
  readonly subtitle: string;
  readonly signal: string;
}

export const WORLD_VISUALS: Readonly<Record<WorldId, WorldVisual>> = {
  nexus: { glyph: '✧', subtitle: 'The gateway to everything nearby.', signal: 'CONNECTED REALITY' },
  noir: { glyph: '◈', subtitle: 'City lights. Hidden stories. A darker lens.', signal: 'AFTER DARK' },
  profiler: { glyph: '◎', subtitle: 'Patterns, profiles and human connections.', signal: 'INSIGHT LAYER' },
  pathfinder: { glyph: '⌖', subtitle: 'Every journey begins with a direction.', signal: 'ROUTE EXPLORER' },
  nocturne: { glyph: '☾', subtitle: 'Find the city when the sun goes down.', signal: 'NIGHT FREQUENCY' },
  diplomat: { glyph: '◇', subtitle: 'Bridge cultures, communities and conversations.', signal: 'SOCIAL BRIDGE' },
  architect: { glyph: '⬡', subtitle: 'Imagine spaces before they exist.', signal: 'BUILD MODE' },
  bazaar: { glyph: '▣', subtitle: 'Discover things worth exchanging.', signal: 'LOCAL MARKET' },
  vanguard: { glyph: '⚑', subtitle: 'Challenges, momentum and new frontiers.', signal: 'MISSION ACTIVE' },
  sanctuary: { glyph: '❀', subtitle: 'A quieter place to belong.', signal: 'CALM SPACE' },
};

export function worldSceneMarkup(worldId: WorldId): string {
  const definition = WORLD_DEFINITIONS[worldId];
  const visual = WORLD_VISUALS[worldId];
  return `<section class="world-scene" aria-label="${definition.displayName} world preview"><div class="world-emblem" aria-hidden="true">${visual.glyph}</div><div class="world-scene-copy"><small>WORLD / ${visual.signal}</small><h2>${definition.displayName}</h2><p>${visual.subtitle}</p></div><span class="world-preview-status">VISUAL CONCEPT · NO WORLD DATA</span></section>`;
}
