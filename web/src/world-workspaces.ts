import type { WorldId } from '../../packages/shared/src/worlds';
import { WORLD_EXPERIENCES } from './world-experience';

type StageLayout = 'gateway' | 'editorial' | 'intelligence' | 'navigation' | 'nightlife' | 'network' | 'blueprint' | 'market' | 'mission' | 'garden';

interface WorldStage {
  readonly layout: StageLayout;
  readonly heading: string;
  readonly caption: string;
  readonly labels: readonly [string, string, string];
}

export const WORLD_STAGES: Readonly<Record<WorldId, WorldStage>> = {
  nexus: { layout: 'gateway', heading: 'Connected viewport', caption: 'One map, many ways to explore.', labels: ['Map signals', 'Pulse lane', 'Connections'] },
  noir: { layout: 'editorial', heading: 'The midnight edition', caption: 'A fictional city journal. No live recommendations.', labels: ['The cover', 'Night index', 'Story archive'] },
  profiler: { layout: 'intelligence', heading: 'Signal observatory', caption: 'Privacy-first, illustrative insight cards only.', labels: ['Signal analysis', 'Interest lattice', 'Visibility'] },
  pathfinder: { layout: 'navigation', heading: 'Route planning canvas', caption: 'Sketch a journey. No routing service or travel estimates.', labels: ['Origin concept', 'Waypoint concept', 'Destination concept'] },
  nocturne: { layout: 'nightlife', heading: 'Night frequency board', caption: 'After-dark moodboard, not verified nightlife data.', labels: ['Explore', 'Atmosphere', 'Safety'] },
  diplomat: { layout: 'network', heading: 'Community constellation', caption: 'Community concepts without real memberships.', labels: ['Culture', 'Dialogue', 'Circles'] },
  architect: { layout: 'blueprint', heading: 'Space blueprint studio', caption: 'Design concepts only. Nothing is created or published.', labels: ['Blueprint', 'Building blocks', 'Draft review'] },
  bazaar: { layout: 'market', heading: 'Local discovery showcase', caption: 'Imagined product shelf. No goods, prices or purchases.', labels: ['Discovery shelf', 'Offer concepts', 'Trade safety'] },
  vanguard: { layout: 'mission', heading: 'Mission control', caption: 'Fictional missions and zero real XP or rankings.', labels: ['Challenge', 'Momentum', 'Team'] },
  sanctuary: { layout: 'garden', heading: 'The quiet garden', caption: 'Low-stimulation social concepts. No sensitive inferences.', labels: ['Quiet spaces', 'Trusted circles', 'Calm controls'] },
};

const escape = (value: string): string => value.replace(/[&<>"']/g, (char) =>
  ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[char] ?? char
);

export function worldStageMarkup(world: WorldId, selectedAction?: string): string {
  const stage = WORLD_STAGES[world];
  const actions = WORLD_EXPERIENCES[world].actions;
  const active = actions.find((action) => action.id === selectedAction) ?? actions[0];
  const tiles = actions.map((action, index) => {
    const chosen = action.id === active.id;
    return `<article class="stage-node${chosen ? ' stage-node-active' : ''}"><div class="stage-node-top"><span>0${index + 1} / ${escape(stage.labels[index] ?? '')}</span><b aria-hidden="true">${escape(action.icon)}</b></div><strong>${escape(action.title)}</strong><small>${escape(action.indicator)}</small><p>${chosen ? escape(action.detail) : 'Select the matching module above to explore this concept.'}</p></article>`;
  }).join('');
  return `<section class="world-stage world-stage--${stage.layout}" aria-label="${escape(world)} unique workspace"><header class="stage-header"><div><span class="stage-kicker">WORLD WORKSPACE / DEMO ONLY</span><h2>${escape(stage.heading)}</h2><p>${escape(stage.caption)}</p></div><span class="stage-layout-mark" aria-hidden="true">${escape(stage.layout.toUpperCase())}</span></header><div class="stage-canvas" role="group" aria-label="Illustrative workspace">${tiles}</div><footer class="stage-footer">SELECTED MODULE / ${escape(active.title.toUpperCase())} · NO REAL ACTIONS</footer></section>`;
}
