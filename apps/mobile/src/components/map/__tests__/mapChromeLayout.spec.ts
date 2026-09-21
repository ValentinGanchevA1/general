import {
  CHALLENGE_CARD_HEIGHT,
} from '@/features/gamification/DailyChallengeCard';
import {
  COMBINED_FILTER_ROW_HEIGHT,
  FAB_BOTTOM,
  INTERACTION_BADGE_SIZE,
  MAP_CHROME_GAP,
  NUDGE_CARD_HEIGHT,
  mapBadgeTop,
  mapChallengeTop,
  mapChromeTops,
  mapFabBottom,
  mapFilterRowTop,
  mapNudgeTop,
  mapTrendingTop,
  type MapTopStackVisibility,
} from '../mapChromeLayout';

const insetsTop = 47;
const BOTH: MapTopStackVisibility = { challengeVisible: true, nudgeVisible: true };
const NONE: MapTopStackVisibility = { challengeVisible: false, nudgeVisible: false };
const CHALLENGE_ONLY: MapTopStackVisibility = { challengeVisible: true, nudgeVisible: false };
const NUDGE_ONLY: MapTopStackVisibility = { challengeVisible: false, nudgeVisible: true };

describe('mapChromeLayout', () => {
  it('stacks challenge → nudge → filter → badge when both visible (closed sheet)', () => {
    const challenge = mapChallengeTop(insetsTop);
    const nudge = mapNudgeTop(insetsTop, BOTH);
    const filter = mapFilterRowTop(insetsTop, false, BOTH);
    const badge = mapBadgeTop(insetsTop, false, BOTH);
    expect(challenge).toBe(insetsTop + MAP_CHROME_GAP);
    expect(nudge).toBe(challenge + CHALLENGE_CARD_HEIGHT + MAP_CHROME_GAP);
    expect(filter).toBe(nudge + NUDGE_CARD_HEIGHT + MAP_CHROME_GAP);
    expect(badge).toBe(filter + COMBINED_FILTER_ROW_HEIGHT + MAP_CHROME_GAP);
    expect(badge).toBeGreaterThan(filter);
  });

  it('collapses filter under safe area when neither card is visible', () => {
    const filter = mapFilterRowTop(insetsTop, false, NONE);
    expect(filter).toBe(insetsTop + MAP_CHROME_GAP);
    expect(filter).toBe(mapChallengeTop(insetsTop));
  });

  it('skips nudge slot when only challenge is visible', () => {
    const challenge = mapChallengeTop(insetsTop);
    const filter = mapFilterRowTop(insetsTop, false, CHALLENGE_ONLY);
    expect(filter).toBe(challenge + CHALLENGE_CARD_HEIGHT + MAP_CHROME_GAP);
    expect(mapNudgeTop(insetsTop, CHALLENGE_ONLY)).toBe(
      challenge + CHALLENGE_CARD_HEIGHT + MAP_CHROME_GAP,
    );
  });

  it('nudge shares challenge top when challenge is hidden', () => {
    expect(mapNudgeTop(insetsTop, NUDGE_ONLY)).toBe(mapChallengeTop(insetsTop));
    const filter = mapFilterRowTop(insetsTop, false, NUDGE_ONLY);
    expect(filter).toBe(
      mapChallengeTop(insetsTop) + NUDGE_CARD_HEIGHT + MAP_CHROME_GAP,
    );
  });

  it('badge sits under filter; filter lifts under safe area when sheet open', () => {
    const closedFilter = mapFilterRowTop(insetsTop, false, BOTH);
    const openFilter = mapFilterRowTop(insetsTop, true, BOTH);
    expect(openFilter).toBe(insetsTop + MAP_CHROME_GAP);
    expect(openFilter).toBeLessThan(closedFilter);
    expect(mapBadgeTop(insetsTop, true, BOTH)).toBe(
      openFilter + COMBINED_FILTER_ROW_HEIGHT + MAP_CHROME_GAP,
    );
  });

  it('mapTrendingTop sits under badge and is sheet + visibility aware', () => {
    const closedBoth = mapTrendingTop(insetsTop, false, BOTH);
    expect(closedBoth).toBe(
      mapBadgeTop(insetsTop, false, BOTH) + INTERACTION_BADGE_SIZE + MAP_CHROME_GAP,
    );
    const closedNone = mapTrendingTop(insetsTop, false, NONE);
    expect(closedNone).toBeLessThan(closedBoth);
    const open = mapTrendingTop(insetsTop, true, BOTH);
    expect(open).toBeLessThan(closedBoth);
  });

  it('mapChromeTops exposes filter before badge', () => {
    const tops = mapChromeTops(insetsTop, false, BOTH);
    expect(tops.filterRow).toBeLessThan(tops.badge);
    expect(tops.badge).toBeLessThan(tops.trending);
  });

  it('mapFabBottom adds safe area and optional offset', () => {
    expect(mapFabBottom(34)).toBe(FAB_BOTTOM + 34);
    expect(mapFabBottom(34, 88)).toBe(FAB_BOTTOM + 34 + 88);
  });

  it('uses matching card heights so stack math stays consistent', () => {
    expect(CHALLENGE_CARD_HEIGHT).toBe(56);
    expect(NUDGE_CARD_HEIGHT).toBe(56);
    expect(COMBINED_FILTER_ROW_HEIGHT).toBe(44);
  });
});
