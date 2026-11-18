import { WORLD_IDS, type WorldId } from '../../packages/shared/src/worlds';

/** Static concept data only. Never represents real people, activity, routes, offers or permissions. */
export interface WorldFocus {
  readonly id: string;
  readonly label: string;
  readonly symbol: string;
  readonly heading: string;
  readonly description: string;
  readonly detail: string;
}
export interface WorldExperience {
  readonly eyebrow: string;
  readonly headline: string;
  readonly description: string;
  readonly layout: 'cinematic' | 'analytical' | 'cartographic' | 'editorial' | 'market' | 'ambient';
  readonly focuses: readonly [WorldFocus, WorldFocus, WorldFocus];
}

export const WORLD_EXPERIENCES: Readonly<Record<WorldId, WorldExperience>> = {
  nexus: {
    eyebrow: 'YOUR CITY · ONE PORTAL', headline: 'Everything starts here',
    description: 'Explore people, happenings and nearby opportunities through a single map.',
    layout: 'cartographic',
    focuses: [
      { id: 'discover', label: 'Discover', symbol: '⌖', heading: 'Your local constellation', description: 'A unified perspective on your surroundings.', detail: 'Concept: a single viewport with people, events and opportunities as separate, permission-aware layers.' },
      { id: 'pulse', label: 'Pulse', symbol: '◉', heading: 'The city is alive', description: 'A contextual stream of activity, not another feed.', detail: 'Concept: nearby updates appear only when their visibility and freshness requirements are satisfied.' },
      { id: 'connect', label: 'Connect', symbol: '↗', heading: 'Turn proximity into connection', description: 'Go from discovery to meaningful interactions.', detail: 'Concept: waves, messaging and invitations remain explicitly consent-based.' },
    ],
  },
  noir: {
    eyebrow: 'CITY AFTER HOURS', headline: 'Follow the hidden lights',
    description: 'An editorial night-city experience with dramatic contrasts and mystery.',
    layout: 'cinematic',
    focuses: [
      { id: 'districts', label: 'Districts', symbol: '◈', heading: 'Shadow districts', description: 'Explore imagined nocturnal city zones.', detail: 'Concept: district stories reveal cultural highlights, never hidden user locations.' },
      { id: 'stories', label: 'Stories', symbol: '▤', heading: 'Stories in the dark', description: 'Narrative-first cards and ambient details.', detail: 'Concept: curated event storytelling with verified sources and explicit creator attribution.' },
      { id: 'signals', label: 'Signals', symbol: '✧', heading: 'After-dark signals', description: 'A restrained night discovery lens.', detail: 'Concept: public night events only; no inferred presence or covert tracking.' },
    ],
  },
  profiler: {
    eyebrow: 'UNDERSTAND THE CONNECTION', headline: 'Patterns, not assumptions',
    description: 'An analytical identity surface shaped like a futuristic insight console.',
    layout: 'analytical',
    focuses: [
      { id: 'identity', label: 'Identity', symbol: '◎', heading: 'The identity canvas', description: 'Structure what a profile chooses to reveal.', detail: 'Concept: explicit profile fields and user-approved sharing; no personality inference.' },
      { id: 'interests', label: 'Interests', symbol: '◌', heading: 'Common ground', description: 'Explore overlaps in stated interests.', detail: 'Concept: interest overlap from declared preferences, without sensitive-trait predictions.' },
      { id: 'trust', label: 'Trust', symbol: '⬡', heading: 'Signals of confidence', description: 'Understand verified claims at a glance.', detail: 'Concept: show factual verification badges and transparent criteria rather than opaque scoring.' },
    ],
  },
  pathfinder: {
    eyebrow: 'MOVE THROUGH POSSIBILITY', headline: 'Choose your next direction',
    description: 'A navigation-oriented experience with path lines and expedition cards.',
    layout: 'cartographic',
    focuses: [
      { id: 'routes', label: 'Routes', symbol: '⌁', heading: 'Routes through the city', description: 'Imagine a connected sequence of places.', detail: 'Concept: route planning must use real routing services and explicit stop choices; none are active here.' },
      { id: 'explore', label: 'Explore', symbol: '⌖', heading: 'Beyond this viewport', description: 'Focus on a destination or local area.', detail: 'Concept: viewport-driven nearby discovery with strict bounds and location privacy.' },
      { id: 'journeys', label: 'Journeys', symbol: '↝', heading: 'Your journey cards', description: 'Plan and collect places worth visiting.', detail: 'Concept: saved itineraries are private until deliberately shared.' },
    ],
  },
  nocturne: {
    eyebrow: 'THE NIGHT HAS A RHYTHM', headline: 'Discover the other side',
    description: 'A neon-lit events experience driven by music culture and evening energy.',
    layout: 'cinematic',
    focuses: [
      { id: 'tonight', label: 'Tonight', symbol: '☾', heading: 'Tonight in the city', description: 'Nightlife, performances and gatherings.', detail: 'Concept: event times, venue opening and availability require verified sources; this panel is illustrative.' },
      { id: 'vibes', label: 'Vibes', symbol: '♫', heading: 'Find your atmosphere', description: 'Explore moods without profiling people.', detail: 'Concept: optional event categories describe venues and activities, not private identities.' },
      { id: 'afterglow', label: 'Afterglow', symbol: '✦', heading: 'When the lights fade', description: 'A visual diary of public experiences.', detail: 'Concept: photos and recaps require contributor rights and participant consent.' },
    ],
  },
  diplomat: {
    eyebrow: 'BUILD BRIDGES', headline: 'Make room for dialogue',
    description: 'A warm editorial interface for communities and cultural exchange.',
    layout: 'editorial',
    focuses: [
      { id: 'circles', label: 'Circles', symbol: '◇', heading: 'Circles of conversation', description: 'Spaces where people gather around a shared purpose.', detail: 'Concept: moderated, opt-in communities with discoverable rules and reporting.' },
      { id: 'exchange', label: 'Exchange', symbol: '⇄', heading: 'Cultural exchange', description: 'A place for stories, language and learning.', detail: 'Concept: translated content should preserve meaning and disclose automated translation.' },
      { id: 'gather', label: 'Gather', symbol: '❖', heading: 'Bring people together', description: 'Organize a purposeful event.', detail: 'Concept: invitations, RSVP and visibility settings require explicit organizer control.' },
    ],
  },
  architect: {
    eyebrow: 'SHAPE THE NEXT SPACE', headline: 'Build a world of your own',
    description: 'A blueprint-inspired composition for creating places and communities.',
    layout: 'analytical',
    focuses: [
      { id: 'blueprint', label: 'Blueprint', symbol: '⬡', heading: 'The blueprint canvas', description: 'Imagine a space before it goes live.', detail: 'Concept: draft spaces support clear ownership, roles and publication boundaries.' },
      { id: 'modules', label: 'Modules', symbol: '▦', heading: 'Assemble your modules', description: 'Events, discussion, resources and membership.', detail: 'Concept: modular capabilities require server-enforced permissions and safe defaults.' },
      { id: 'publish', label: 'Publish', symbol: '↗', heading: 'From draft to discovery', description: 'Review a space before opening its doors.', detail: 'Concept: publishing requires checks for abuse, moderation and visibility.' },
    ],
  },
  bazaar: {
    eyebrow: 'THE LOCAL EXCHANGE', headline: 'Things worth discovering',
    description: 'A storefront-inspired marketplace with strong cards and warm surfaces.',
    layout: 'market',
    focuses: [
      { id: 'finds', label: 'Finds', symbol: '▣', heading: 'Local discoveries', description: 'A curated presentation of nearby items.', detail: 'Concept: listings need price, condition, seller verification and abuse reporting.' },
      { id: 'offers', label: 'Offers', symbol: '◇', heading: 'Start a conversation', description: 'A space for transparent offers and negotiation.', detail: 'Concept: offers require explicit acceptance and audit records; no transaction occurs in this demo.' },
      { id: 'trade', label: 'Trade', symbol: '⇄', heading: 'Exchange with confidence', description: 'A clear journey from offer to handover.', detail: 'Concept: safe local trade, payment boundaries and dispute flows must be implemented before launch.' },
    ],
  },
  vanguard: {
    eyebrow: 'THE FRONT LINE OF PROGRESS', headline: 'Choose your challenge',
    description: 'A bold mission console with progress paths and achievement motifs.',
    layout: 'analytical',
    focuses: [
      { id: 'missions', label: 'Missions', symbol: '⚑', heading: 'Your next mission', description: 'Small challenges that lead somewhere.', detail: 'Concept: participation must be voluntary, safe and accessible.' },
      { id: 'achieve', label: 'Achievements', symbol: '✦', heading: 'Milestones earned', description: 'Celebrate useful contributions.', detail: 'Concept: progress and achievement data require server validation to prevent gaming.' },
      { id: 'teams', label: 'Teams', symbol: '⬡', heading: 'Move forward together', description: 'Community challenges and collective goals.', detail: 'Concept: leaderboards need privacy controls and anti-harassment safeguards.' },
    ],
  },
  sanctuary: {
    eyebrow: 'A MOMENT TO BELONG', headline: 'Find your quiet space',
    description: 'An intimate ambient interface built around comfort, boundaries and calm.',
    layout: 'ambient',
    focuses: [
      { id: 'space', label: 'Quiet space', symbol: '❀', heading: 'A softer place', description: 'A slower rhythm for meaningful interactions.', detail: 'Concept: intentional visibility and gentle defaults protect user boundaries.' },
      { id: 'circles', label: 'Trusted circles', symbol: '◌', heading: 'Small, chosen circles', description: 'Belonging starts with mutual trust.', detail: 'Concept: circles remain opt-in and membership is never inferred from proximity.' },
      { id: 'boundaries', label: 'Boundaries', symbol: '☯', heading: 'Your space, your rules', description: 'Choose when and how to be reachable.', detail: 'Concept: blocking, consent, notification limits and safety controls are foundational.' },
    ],
  },
};

export function experienceFocus(worldId: WorldId, requestedId: string | null): WorldFocus {
  const focuses = WORLD_EXPERIENCES[worldId].focuses;
  return focuses.find((focus) => focus.id === requestedId) ?? focuses[0];
}

/** Escape dynamic values if this module later receives non-constant data. Current values are authored constants. */
export function worldExperienceMarkup(worldId: WorldId, focusId: string | null): string {
  const world = WORLD_EXPERIENCES[worldId];
  const focus = experienceFocus(worldId, focusId);
  const tabs = world.focuses.map((item) =>
    `<button type="button" class="experience-focus${item.id === focus.id ? ' selected' : ''}" data-world-focus="${item.id}" aria-pressed="${item.id === focus.id ? 'true' : 'false'}"><span aria-hidden="true">${item.symbol}</span>${item.label}</button>`,
  ).join('');
  return `<section class="world-experience" aria-label="${worldId} interactive concept" data-layout="${world.layout}">
    <div class="experience-hero"><p class="experience-kicker">${world.eyebrow}</p><h2>${world.headline}</h2><p>${world.description}</p><div class="experience-trails"><span></span><span></span><span></span></div></div>
    <div class="experience-console"><p class="experience-counter">01 / 03 · SELECT A CONCEPT LENS</p><div class="experience-focuses" role="group" aria-label="Concept lenses">${tabs}</div><article class="experience-detail" aria-live="polite"><span class="experience-detail-icon" aria-hidden="true">${focus.symbol}</span><div><h3>${focus.heading}</h3><p>${focus.description}</p><small>${focus.detail}</small></div></article><p class="experience-disclaimer">INTERACTIVE UX PROTOTYPE · DEMO DATA ONLY · NO LIVE WORLD ACTIONS</p></div>
  </section>`;
}

export function hasUniqueExperiences(): boolean {
  return WORLD_IDS.every((id) => WORLD_EXPERIENCES[id].focuses.length === 3);
}
