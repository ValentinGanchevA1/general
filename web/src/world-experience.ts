import { WORLD_DEFINITIONS, WORLD_IDS, type WorldId } from '../../packages/shared/src/worlds';

/** Entirely fictional, local demo content. No permissions, profiles or API calls. */
interface WorldMoment {
  readonly icon: string;
  readonly name: string;
  readonly detail: string;
  readonly metric: string;
  readonly tag: string;
}
interface WorldExperience {
  readonly mode: string;
  readonly heading: string;
  readonly intro: string;
  readonly metricLabel: string;
  readonly metric: string;
  readonly moments: readonly [WorldMoment, WorldMoment, WorldMoment];
}
export const WORLD_EXPERIENCES: Readonly<Record<WorldId, WorldExperience>> = {
  nexus: { mode: 'constellation', heading: 'The city is your constellation', intro: 'One surface connecting people, stories and places.', metricLabel: 'DISCOVERY SIGNAL', metric: 'ONLINE', moments: [
    { icon:'✦', name:'People pulse', detail:'Preview a constellation of nearby conversations. No real profiles are shown.', metric:'02', tag:'SOCIAL' },
    { icon:'◇', name:'Shared moments', detail:'Find a fictional gathering around the sea garden.', metric:'03', tag:'EVENTS' },
    { icon:'⌖', name:'Local orbit', detail:'A conceptual view of community activity across the map.', metric:'01', tag:'MAP' },
  ] },
  noir: { mode: 'casefile', heading: 'Follow the unsaid', intro: 'A cinematic caseboard for hidden city stories.', metricLabel: 'CASE FILE', metric: 'N-001', moments: [
    { icon:'◈', name:'The blue door', detail:'An imaginary story clue: a photograph taken just after midnight.', metric:'01', tag:'EVIDENCE' },
    { icon:'⌁', name:'Street echoes', detail:'Trace fictional whispers between two night-time landmarks.', metric:'02', tag:'LEAD' },
    { icon:'◎', name:'Open dossier', detail:'Inspect a concept-only case timeline. There are no actual investigations.', metric:'03', tag:'DOSSIER' },
  ] },
  profiler: { mode: 'scanner', heading: 'See the patterns', intro: 'Explore how connections might be understood without making real-world inferences.', metricLabel: 'SCAN STATUS', metric: 'SANDBOX', moments: [
    { icon:'◎', name:'Interest signals', detail:'Compare fictional interest tags inside a sample profile.', metric:'74%', tag:'SIMULATION' },
    { icon:'◉', name:'Shared circles', detail:'Explore overlapping sample groups without accessing actual user relationships.', metric:'03', tag:'NETWORK' },
    { icon:'▧', name:'Profile layers', detail:'Review a made-up identity card and its privacy boundary.', metric:'04', tag:'IDENTITY' },
  ] },
  pathfinder: { mode: 'waypoints', heading: 'Every route tells a story', intro: 'A journey planner concept built from imaginary waypoints.', metricLabel: 'ROUTE STATUS', metric: 'PLANNING', moments: [
    { icon:'①', name:'Starting point', detail:'Concept stop: begin a walk near the city center.', metric:'START', tag:'WAYPOINT' },
    { icon:'②', name:'Coastal turn', detail:'Concept stop: explore a scenic path, with no real navigation guidance.', metric:'MID', tag:'WAYPOINT' },
    { icon:'③', name:'The lookout', detail:'Concept stop: arrive at a fictional gathering spot.', metric:'END', tag:'WAYPOINT' },
  ] },
  nocturne: { mode: 'frequency', heading: 'Tune into the night', intro: 'An after-dark signal board for imagined happenings.', metricLabel: 'NIGHT CHANNEL', metric: '88.8', moments: [
    { icon:'☾', name:'Late sessions', detail:'A fictional night gathering with an ambient soundscape concept.', metric:'21:00', tag:'AFTER DARK' },
    { icon:'✧', name:'City lights', detail:'Preview illuminated places on a conceptual night lens.', metric:'23:00', tag:'PLACES' },
    { icon:'◌', name:'Quiet hours', detail:'A low-noise discovery mode, without live tracking.', metric:'02:00', tag:'AMBIENT' },
  ] },
  diplomat: { mode: 'dialogue', heading: 'Build a bridge', intro: 'Conversations across perspectives, without real messages.', metricLabel: 'DIALOGUE ROOM', metric: 'OPEN', moments: [
    { icon:'◇', name:'Common ground', detail:'A fictional icebreaker designed around shared interests.', metric:'HELLO', tag:'CONNECT' },
    { icon:'❖', name:'Cultural exchange', detail:'Explore a sample multilingual community introduction.', metric:'3 LANG', tag:'COMMUNITY' },
    { icon:'◎', name:'Round table', detail:'Preview a small-group conversation space with privacy controls.', metric:'04', tag:'DIALOGUE' },
  ] },
  architect: { mode: 'blueprint', heading: 'Sketch a new world', intro: 'A spatial composition board where every structure is an idea.', metricLabel: 'DESIGN GRID', metric: '12 × 12', moments: [
    { icon:'⬡', name:'Place a hub', detail:'Concept blueprint: a meeting hub anchored to a fictional district.', metric:'01', tag:'STRUCTURE' },
    { icon:'▦', name:'Define zones', detail:'Concept blueprint: separate public, shared and private spaces.', metric:'03', tag:'ZONING' },
    { icon:'⌘', name:'Preview layers', detail:'See how map layers could be organized for future collaborative spaces.', metric:'05', tag:'LAYERING' },
  ] },
  bazaar: { mode: 'storefront', heading: 'The local exchange', intro: 'Browse a concept market using completely fictional items.', metricLabel: 'DEMO COLLECTION', metric: '03 ITEMS', moments: [
    { icon:'▣', name:'Vintage camera', detail:'Fictional listing mockup. No seller, price or checkout is real.', metric:'€80', tag:'OBJECTS' },
    { icon:'◇', name:'Handmade ceramics', detail:'Fictional craft listing for browsing interactions only.', metric:'€24', tag:'CRAFT' },
    { icon:'⬡', name:'Urban bicycle', detail:'Fictional mobility listing. Transactions are disabled.', metric:'€140', tag:'LOCAL' },
  ] },
  vanguard: { mode: 'missions', heading: 'Choose your next challenge', intro: 'A mission control concept with no real score or rankings.', metricLabel: 'MISSION STATUS', metric: 'READY', moments: [
    { icon:'⚑', name:'Discover 3 places', detail:'Concept mission: explore three made-up discovery points.', metric:'01', tag:'EXPLORE' },
    { icon:'✸', name:'Community spark', detail:'Concept mission: imagine a local event challenge.', metric:'02', tag:'IMPACT' },
    { icon:'◆', name:'First milestone', detail:'Concept achievement panel. XP and rewards are not active.', metric:'03', tag:'PROGRESS' },
  ] },
  sanctuary: { mode: 'retreat', heading: 'Make room to breathe', intro: 'A calm, low-stimulation social space concept.', metricLabel: 'SPACE STATUS', metric: 'PEACEFUL', moments: [
    { icon:'❀', name:'Quiet garden', detail:'A fictional retreat space with gentle visual details.', metric:'CALM', tag:'REST' },
    { icon:'○', name:'Small circle', detail:'Concept-only gathering with consent-first interactions.', metric:'4 SEATS', tag:'BELONG' },
    { icon:'☼', name:'Open reflection', detail:'A private journaling concept; nothing is stored or submitted.', metric:'PAUSE', tag:'REFLECT' },
  ] },
};

export function worldExperienceMarkup(worldId: WorldId, selected: number): string {
  const def = WORLD_DEFINITIONS[worldId];
  const data = WORLD_EXPERIENCES[worldId];
  const index = Number.isInteger(selected) && selected >= 0 && selected < data.moments.length ? selected : 0;
  const active = data.moments[index] ?? data.moments[0];
  const items = data.moments.map((item, i) =>
    `<button type="button" class="world-moment${i === index ? ' active' : ''}" data-world-focus="${i}" aria-pressed="${i === index}" aria-label="${item.name}"><span class="world-moment-icon" aria-hidden="true">${item.icon}</span><span class="world-moment-text"><strong>${item.name}</strong><small>${item.tag}</small></span><b>${item.metric}</b></button>`
  ).join('');
  return `<section class="world-workspace world-layout-${data.mode}" aria-label="${def.displayName} interactive concept"><div class="world-workspace-heading"><div><span class="world-kicker">INTERACTIVE CONCEPT / ${def.displayName}</span><h2>${data.heading}</h2><p>${data.intro}</p></div><div class="world-indicator"><small>${data.metricLabel}</small><strong>${data.metric}</strong></div></div><div class="world-workspace-grid"><div class="world-moment-list" role="group" aria-label="Concept scenes">${items}</div><article class="world-detail" aria-live="polite"><div class="world-detail-orbit" aria-hidden="true">${active.icon}</div><small>SCENE 0${index + 1} / 03 · ${active.tag}</small><h3>${active.name}</h3><p>${active.detail}</p><span class="world-demo-note">ILLUSTRATIVE CONTENT · NOT LIVE DATA</span></article></div></section>`;
}

/** Explicit allowlist used by the demo contract test. */
export const WORLD_LAYOUTS = WORLD_IDS.map((id) => WORLD_EXPERIENCES[id].mode);
