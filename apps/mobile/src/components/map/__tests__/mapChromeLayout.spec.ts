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
  it('stacks challenge → nudge → badge when both visible (closed sheet)', () => {
    const challenge = mapChallengeTop(insetsTop);
    const nudge = mapNudgeTop(insetsTop, BOTH);
    const badge = mapBadgeTop(insetsTop, false, BOTH);
    expect(challenge).toBe(insetsTop + MAP_CHROME_GAP);
    expect(nudge).toBe(challenge + CHALLENGE_CARD_HEIGHT + MAP_CHROME_GAP);
    expect(badge).toBe(nudge + NUDGE_CARD_HEIGHT + MAP_CHROME_GAP);
    expect(badge).toBeGreaterThan(nudge);
  });

  it('collapses badge under safe area when neither card is visible', () => {
    const badge = mapBadgeTop(insetsTop, false, NONE);
    expect(badge).toBe(insetsTop + MAP_CHROME_GAP);
    expect(badge).toBe(mapChallengeTop(insetsTop));
  });

  it('skips nudge slot when only challenge is visible', () => {
    const challenge = mapChallengeTop(insetsTop);
    const badge = mapBadgeTop(insetsTop, false, CHALLENGE_ONLY);
    expect(badge).toBe(challenge + CHALLENGE_CARD_HEIGHT + MAP_CHROME_GAP);
    expect(mapNudgeTop(insetsTop, CHALLENGE_ONLY)).toBe(
      challenge + CHALLENGE_CARD_HEIGHT + MAP_CHROME_GAP,
    );
  });

  it('nudge shares challenge top when challenge is hidden', () => {
    expect(mapNudgeTop(insetsTop, NUDGE_ONLY)).toBe(mapChallengeTop(insetsTop));
    const badge = mapBadgeTop(insetsTop, false, NUDGE_ONLY);
    expect(badge).toBe(
      mapChallengeTop(insetsTop) + NUDGE_CARD_HEIGHT + MAP_CHROME_GAP,
    );
  });

  it('lifts badge under safe area when sheet is open (ignores visibility)', () => {
    const closed = mapBadgeTop(insetsTop, false, BOTH);
    const open = mapBadgeTop(insetsTop, true, BOTH);
    expect(open).toBe(insetsTop + MAP_CHROME_GAP);
    expect(open).toBeLessThan(closed);
    expect(open).toBe(mapChallengeTop(insetsTop));
  });

  it('mapChromeTops preserves vertical order (closed sheet, both visible)', () => {
    const tops = mapChromeTops(insetsTop, false, BOTH);
    expect(tops.challenge).toBeLessThan(tops.nudge);
    expect(tops.nudge).toBeLessThan(tops.badge);
    expect(tops.badge).toBeLessThan(tops.filterRow);
    expect(tops.filterRow).toBeLessThan(tops.trending);
  });

  it('mapChromeTops collapses top stack when sheet open', () => {
    const tops = mapChromeTops(insetsTop, true, BOTH);
    expect(tops.badge).toBe(tops.challenge);
  });

  it('mapFilterRowTop sits under badge and collapses with visibility', () => {
    const both = mapFilterRowTop(insetsTop, false, BOTH);
    const none = mapFilterRowTop(insetsTop, false, NONE);
    expect(both).toBe(
      mapBadgeTop(insetsTop, false, BOTH) + INTERACTION_BADGE_SIZE + MAP_CHROME_GAP,
    );
    expect(none).toBe(
      mapBadgeTop(insetsTop, false, NONE) + INTERACTION_BADGE_SIZE + MAP_CHROME_GAP,
    );
    expect(none).toBeLessThan(both);
  });

  it('mapFilterRowTop lifts with badge when sheet open', () => {
    const closed = mapFilterRowTop(insetsTop, false, BOTH);
    const open = mapFilterRowTop(insetsTop, true, BOTH);
    expect(open).toBe(
      mapBadgeTop(insetsTop, true, BOTH) + INTERACTION_BADGE_SIZE + MAP_CHROME_GAP,
    );
    expect(open).toBeLessThan(closed);
  });

  it('mapTrendingTop sits under combined filter row and is sheet + visibility aware', () => {
    const closedBoth = mapTrendingTop(insetsTop, false, BOTH);
    expect(closedBoth).toBe(
      mapFilterRowTop(insetsTop, false, BOTH) + COMBINED_FILTER_ROW_HEIGHT + MAP_CHROME_GAP,
    );
    const closedNone = mapTrendingTop(insetsTop, false, NONE);
    expect(closedNone).toBeLessThan(closedBoth);
    const open = mapTrendingTop(insetsTop, true, BOTH);
    expect(open).toBeLessThan(closedBoth);
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
