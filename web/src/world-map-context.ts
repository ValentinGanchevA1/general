import type { WorldId } from '../../packages/shared/src/worlds';
import { WORLD_EXPERIENCES } from './world-experience';

/** Strict allowlist of fictional map fixtures; no real user or live discovery data. */
export const DEMO_MAP_MARKERS = {
  'user:maria': { title: 'Maria · demo profile', kind: 'People', note: 'Fictional nearby profile used to demonstrate contextual discovery.' },
  'user:alex': { title: 'Alex · demo profile', kind: 'People', note: 'Fictional social presence. No actual identity or location is being displayed.' },
  'event:sunset': { title: 'Sunset meetup · demo event', kind: 'Experience', note: 'Illustrative city gathering; no RSVP or live capacity is available.' },
  'listing:bike': { title: 'City bicycle · demo listing', kind: 'Marketplace', note: 'Illustrative local trade card; no offer, payment, or contact is possible.' },
  'cluster:busy': { title: 'Nearby signals · demo cluster', kind: 'Discovery', note: 'Illustrative grouped pins, not a count of real people in this area.' },
} as const;

export type DemoMapMarkerId = keyof typeof DEMO_MAP_MARKERS;

export function isDemoMapMarkerId(value: string): value is DemoMapMarkerId {
  return Object.prototype.hasOwnProperty.call(DEMO_MAP_MARKERS, value);
}

const esc = (value: string): string =>
  value.replace(/[&<>"']/g, (char) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[char] ?? char);

export function worldMapContextMarkup(worldId: WorldId, markerId: string | null): string {
  if (!markerId || !isDemoMapMarkerId(markerId)) return '';
  const marker = DEMO_MAP_MARKERS[markerId];
  const world = WORLD_EXPERIENCES[worldId];
  const action = world.actions[0];
  return `<section class="world-map-context" aria-label="Demo map selection" role="status"><div class="world-map-context-head"><small>${esc(worldId.toUpperCase())} / ${esc(marker.kind)} / FICTIONAL</small><button type="button" class="world-map-context-close" data-close-map-context="1" aria-label="Close selected map item">×</button></div><h3>${esc(marker.title)}</h3><p>${esc(marker.note)}</p><div class="world-map-context-lens"><span aria-hidden="true">${esc(action.icon)}</span><div><strong>${esc(action.title)} lens</strong><small>${esc(action.detail)}</small></div></div><footer>INTERACTIVE UI PREVIEW · NO LIVE DATA OR REAL ACTIONS</footer></section>`;
}
