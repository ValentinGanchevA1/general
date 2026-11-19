import type { WorldId } from '../../packages/shared/src/worlds';
import { isDemoMapMarkerId, type DemoMapMarkerId } from './world-map-context';

export type DemoAction = 'wave' | 'rsvp' | 'offer';
export type DemoInteractionState = Readonly<Partial<Record<DemoMapMarkerId, boolean>>>;

/** Deliberately session-memory only. No browser persistence, API, messages, or payments. */
export function actionForMarker(id: string): DemoAction | null {
  if (!isDemoMapMarkerId(id)) return null;
  if (id.startsWith('user:')) return 'wave';
  if (id === 'event:sunset') return 'rsvp';
  if (id === 'listing:bike') return 'offer';
  return null;
}

export function toggleDemoInteraction(
  current: DemoInteractionState,
  markerId: string,
): DemoInteractionState {
  if (!actionForMarker(markerId) || !isDemoMapMarkerId(markerId)) return current;
  return { ...current, [markerId]: !current[markerId] };
}

const escapeHtml = (value: string): string =>
  value.replace(/[&<>"']/g, (char) =>
    ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[char] ?? char);

const LABELS: Readonly<Record<DemoAction, readonly [string, string, string]>> = {
  wave: ['Send demo wave', 'Undo demo wave', 'Local wave simulation only; no person was contacted.'],
  rsvp: ['Join demo event', 'Undo demo RSVP', 'Local RSVP simulation only; no event registration.'],
  offer: ['Prepare demo offer', 'Discard demo offer', 'Local offer simulation only; no purchase or seller contact.'],
};

export function demoInteractionMarkup(
  world: WorldId,
  markerId: string | null,
  interactions: DemoInteractionState,
): string {
  if (!markerId || !isDemoMapMarkerId(markerId)) return '';
  const action = actionForMarker(markerId);
  if (!action) return '';
  const [initial, undo, explanation] = LABELS[action];
  const active = interactions[markerId] === true;
  const label = active ? undo : initial;
  return `<section class="world-demo-interaction" aria-label="Fictional interaction simulator"><div class="demo-interaction-status"><strong>${escapeHtml(world.toUpperCase())} / ${escapeHtml(action.toUpperCase())}</strong><span>${active ? 'SIMULATED · ACTIVE' : 'SIMULATED · READY'}</span></div><button type="button" class="world-demo-interaction-button" data-demo-interaction="${escapeHtml(markerId)}" aria-pressed="${active}">${escapeHtml(label)}</button><p role="status">${escapeHtml(explanation)}</p><small>DEMO ONLY · NOT SENT · RESETS ON RELOAD</small></section>`;
}
