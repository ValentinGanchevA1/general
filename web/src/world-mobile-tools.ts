import type { WorldId } from '../../packages/shared/src/worlds';
import { WORLD_EXPERIENCES } from './world-experience';

function escapeHtml(value: string): string {
  return value.replace(/[&<>"']/g, (char) =>
    ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[char] ?? char);
}

/** UI-only shortcuts. No server requests, location collection or real actions. */
export function worldMobileDockMarkup(worldId: WorldId, activeAction: string | null): string {
  const actions = WORLD_EXPERIENCES[worldId].actions;
  const buttons = actions.map((action) => {
    const active = action.id === activeAction;
    return `<button type="button" class="world-dock-action${active ? ' is-active' : ''}" data-mobile-action="${action.id}" aria-pressed="${active}" aria-label="Preview ${escapeHtml(action.title)}"><span aria-hidden="true">${escapeHtml(action.icon)}</span><strong>${escapeHtml(action.title)}</strong></button>`;
  }).join('');
  return `<nav class="world-mobile-dock" aria-label="Current world concept tools"><span class="world-dock-label">${escapeHtml(worldId.toUpperCase())} TOOLS · DEMO</span><div class="world-dock-actions">${buttons}</div></nav>`;
}

export function worldMobileSheetMarkup(worldId: WorldId, activeAction: string | null): string {
  const action = WORLD_EXPERIENCES[worldId].actions.find((item) => item.id === activeAction);
  if (!action) return '';
  return `<div class="world-sheet-root"><button type="button" class="world-sheet-backdrop" data-close-world-sheet="1" aria-label="Close concept panel"></button><section class="world-mobile-sheet" role="dialog" aria-modal="true" aria-label="${escapeHtml(action.title)} concept panel"><div class="world-sheet-handle" aria-hidden="true"></div><div class="world-sheet-top"><span>PREVIEW ONLY · ${escapeHtml(worldId.toUpperCase())}</span><button type="button" class="world-sheet-close" id="world-sheet-close" data-close-world-sheet="1" aria-label="Close panel">×</button></div><div class="world-sheet-icon" aria-hidden="true">${escapeHtml(action.icon)}</div><h2>${escapeHtml(action.title)}</h2><small>${escapeHtml(action.indicator)}</small><p>${escapeHtml(action.detail)}</p><div class="world-sheet-disclaimer">Illustrative interface only · No live services or user data</div></section></div>`;
}
