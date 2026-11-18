import { WORLD_DEFINITIONS, WORLD_IDS, type WorldId } from '../../../packages/shared/src/worlds';

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
