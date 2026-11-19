import type { WorldId } from '../../packages/shared/src/worlds';

export interface WorldAction {
  readonly id: string;
  readonly icon: string;
  readonly title: string;
  readonly detail: string;
  readonly indicator: string;
}

export interface WorldExperience {
  readonly eyebrow: string;
  readonly headline: string;
  readonly summary: string;
  readonly metric: string;
  readonly metricLabel: string;
  readonly actions: readonly [WorldAction, WorldAction, WorldAction];
}

/** Local visual concept data only. No real people, event, listing or trust data. */
export const WORLD_EXPERIENCES: Readonly<Record<WorldId, WorldExperience>> = {
  nexus: {
    eyebrow: 'THE CONNECTED CITY', headline: 'Your world, in motion.',
    summary: 'Explore the gateway to places, people and moments around you.',
    metric: '01', metricLabel: 'ONE CONNECTED WORLD',
    actions: [
      { id: 'discover', icon: '⌖', title: 'Discover', indicator: 'MAP LENS', detail: 'A spatial discovery lens for local moments, people and opportunities.' },
      { id: 'pulse', icon: '◉', title: 'Pulse', indicator: 'LIVE SIGNALS', detail: 'A preview of neighborhood activity and shared real-time presence.' },
      { id: 'connect', icon: '✧', title: 'Connect', indicator: 'SOCIAL GRAPH', detail: 'Explore meaningful local connections with privacy-first interaction flows.' },
    ],
  },
  noir: {
    eyebrow: 'THE HIDDEN CITY', headline: 'Follow the afterglow.',
    summary: 'Neon streets, cinematic rendezvous and a moody urban nightscape.',
    metric: '22:00', metricLabel: 'FICTIONAL NIGHT SIGNAL',
    actions: [
      { id: 'alleys', icon: '◈', title: 'Hidden alleys', indicator: 'SHADOW LENS', detail: 'Concept-only city stories revealed through dramatic contrast and nocturnal landmarks.' },
      { id: 'venues', icon: '♢', title: 'Late venues', indicator: 'CITY LIGHTS', detail: 'A curated visual concept for late-night locations, not live venue availability.' },
      { id: 'stories', icon: '☷', title: 'City stories', indicator: 'STORY ARCHIVE', detail: 'Short atmospheric story cards could be surfaced by place and time.' },
    ],
  },
  profiler: {
    eyebrow: 'HUMAN SIGNALS', headline: 'See the patterns.',
    summary: 'A precise dashboard for shared interests and transparent identity signals.',
    metric: '03', metricLabel: 'DEMO INSIGHT CARDS',
    actions: [
      { id: 'insights', icon: '◎', title: 'Insights', indicator: 'SIGNAL MAP', detail: 'Explainable, opt-in interest overlap instead of opaque personal scoring.' },
      { id: 'interests', icon: '≋', title: 'Interests', indicator: 'TOPIC MATRIX', detail: 'A visual matrix of voluntarily shared topics, with user-controlled visibility.' },
      { id: 'privacy', icon: '◇', title: 'Privacy', indicator: 'USER CONTROL', detail: 'Granular privacy controls are essential before any personal profiling is implemented.' },
    ],
  },
  pathfinder: {
    eyebrow: 'WAYS THROUGH THE CITY', headline: 'Choose a direction.',
    summary: 'Route lines, landmarks and a journey planner imagined over the real map.',
    metric: 'N →', metricLabel: 'EXPLORATION BEARING',
    actions: [
      { id: 'routes', icon: '⌁', title: 'Routes', indicator: 'WAYPOINTS', detail: 'A concept for multi-stop journeys, not live directions or travel times.' },
      { id: 'landmarks', icon: '⌖', title: 'Landmarks', indicator: 'POINTS OF INTEREST', detail: 'See how meaningful destinations could anchor a personalized city trail.' },
      { id: 'trails', icon: '⇢', title: 'Trails', indicator: 'PATH MEMORY', detail: 'Opt-in saved trails with no passive location history collection.' },
    ],
  },
  nocturne: {
    eyebrow: 'NIGHT FREQUENCY', headline: 'Own the night.',
    summary: 'A violet after-dark atmosphere made for experiences and evening discovery.',
    metric: '☾', metricLabel: 'NIGHT MODE',
    actions: [
      { id: 'afterdark', icon: '☾', title: 'After dark', indicator: 'NIGHT SCENE', detail: 'Imagined nighttime event cards with deliberate safety and visibility controls.' },
      { id: 'rhythm', icon: '♫', title: 'Rhythm', indicator: 'VENUE VIBES', detail: 'A visual mood selector for experiences; no live music or venue data is claimed.' },
      { id: 'safety', icon: '✦', title: 'Safety', indicator: 'TRUST FIRST', detail: 'Safe meetup tips and opt-in visibility are required for a real nocturnal feature.' },
    ],
  },
  diplomat: {
    eyebrow: 'COMMON GROUND', headline: 'Build bridges.',
    summary: 'Warm cultural layers and deliberate connection across communities.',
    metric: '∞', metricLabel: 'POSSIBLE CONNECTIONS',
    actions: [
      { id: 'circles', icon: '◇', title: 'Circles', indicator: 'COMMUNITIES', detail: 'Conceptual community circles organized by shared interests and invitations.' },
      { id: 'dialogue', icon: '◎', title: 'Dialogue', indicator: 'OPEN CONVERSATION', detail: 'Moderated, consensual conversations with clear reporting paths.' },
      { id: 'culture', icon: '✧', title: 'Culture', indicator: 'LOCAL EXCHANGE', detail: 'Discover how language and culture could shape contextual city experiences.' },
    ],
  },
  architect: {
    eyebrow: 'DESIGN THE FUTURE', headline: 'Shape a new space.',
    summary: 'Blueprint grids and modular cards for creating meaningful local spaces.',
    metric: '▦', metricLabel: 'BLUEPRINT PREVIEW',
    actions: [
      { id: 'blueprint', icon: '▦', title: 'Blueprint', indicator: 'SPACE CANVAS', detail: 'A concept canvas for planning a place-based group or event.' },
      { id: 'modules', icon: '⬡', title: 'Modules', indicator: 'BUILDING BLOCKS', detail: 'Composable blocks for rules, capacity, invitations and visibility.' },
      { id: 'publish', icon: '↗', title: 'Publish plan', indicator: 'DRAFT ONLY', detail: 'A safe draft workflow: no space is created or published by this demo.' },
    ],
  },
  bazaar: {
    eyebrow: 'LOCAL EXCHANGE', headline: 'Find the unexpected.',
    summary: 'A warm marketplace atmosphere with item cards, discovery and negotiation.',
    metric: '€—', metricLabel: 'NO LIVE PRICES',
    actions: [
      { id: 'browse', icon: '▣', title: 'Browse', indicator: 'DISCOVERY SHELF', detail: 'Explore a visual concept for browsing local goods without real listings.' },
      { id: 'offer', icon: '◇', title: 'Make an offer', indicator: 'NEGOTIATION', detail: 'A future protected offer flow with anti-fraud limits and clear seller consent.' },
      { id: 'trade', icon: '⇄', title: 'Local trade', indicator: 'SAFE EXCHANGE', detail: 'Illustrative pickup and trade safety guidance; no transaction is initiated.' },
    ],
  },
  vanguard: {
    eyebrow: 'THE FRONT LINE', headline: 'Take the challenge.',
    summary: 'Bold mission cards, bright progress lines and action-first energy.',
    metric: '00 XP', metricLabel: 'ILLUSTRATIVE PROGRESS',
    actions: [
      { id: 'missions', icon: '⚑', title: 'Missions', indicator: 'CHALLENGE BOARD', detail: 'Example challenge concepts with no real rewards or verified achievements.' },
      { id: 'progress', icon: '▥', title: 'Progress', indicator: 'MOMENTUM', detail: 'A progress rail that could encourage healthy participation without addictive loops.' },
      { id: 'teams', icon: '◇', title: 'Teams', indicator: 'COOPERATIVE PLAY', detail: 'Opt-in shared challenges with abuse prevention and moderation.' },
    ],
  },
  sanctuary: {
    eyebrow: 'A SPACE TO BREATHE', headline: 'Find your calm.',
    summary: 'Soft gradients, quiet circles and an intentionally gentle social rhythm.',
    metric: '◌', metricLabel: 'QUIET PRESENCE',
    actions: [
      { id: 'quiet', icon: '❀', title: 'Quiet spaces', indicator: 'SOFT DISCOVERY', detail: 'Imagine low-stimulation community spaces with explicit visibility controls.' },
      { id: 'circles', icon: '◌', title: 'Small circles', indicator: 'TRUSTED GROUPS', detail: 'Private opt-in circles with membership boundaries and clear moderation.' },
      { id: 'pause', icon: '☼', title: 'Pause', indicator: 'CALM MODE', detail: 'A reduced-distraction interface, without inferring any health or emotional state.' },
    ],
  },
};

export function worldExperienceMarkup(world: WorldId, selectedAction?: string): string {
  const experience = WORLD_EXPERIENCES[world];
  const selected = experience.actions.find((action) => action.id === selectedAction) ?? experience.actions[0];
  const actionButtons = experience.actions.map((action, index) =>
    `<button type="button" class="world-tool${action.id === selected.id ? ' is-active' : ''}" data-world-action="${action.id}" aria-pressed="${action.id === selected.id}" aria-label="${action.title} concept"><span class="world-tool-index">0${index + 1} / ${action.indicator}</span><b class="world-tool-icon" aria-hidden="true">${action.icon}</b><strong>${action.title}</strong><span class="world-tool-arrow" aria-hidden="true">↗</span></button>`
  ).join('');
  return `<section class="world-experience" aria-label="${world} interactive concept"><div class="world-experience-hero"><div class="world-experience-copy"><span class="world-experience-eyebrow">${experience.eyebrow} · INTERACTIVE CONCEPT</span><h2>${experience.headline}</h2><p>${experience.summary}</p></div><div class="world-experience-orbit" aria-hidden="true"><span>${experience.metric}</span><small>${experience.metricLabel}</small></div></div><div class="world-tool-grid">${actionButtons}</div><div class="world-tool-detail" role="status"><span class="world-tool-detail-label">${selected.indicator} / PREVIEW ONLY</span><p>${selected.detail}</p></div></section>`;
}
