import { CHALLENGE_CARD_HEIGHT } from '@/features/gamification/DailyChallengeCard';

import {
  FAB_BOTTOM,
  INTERACTION_BADGE_SIZE,
  MAP_CHROME,
  MAP_CHROME_GAP,
  NUDGE_CARD_HEIGHT,
  mapBadgeTop,
  mapChallengeTop,
  mapChromeTops,
  mapFabBottom,
  mapNudgeTop,
} from '../mapChromeLayout';

describe('mapChromeLayout', () => {
  const insetsTop = 44;

  it('exposes stable MAP_CHROME tokens', () => {
    expect(MAP_CHROME.gap).toBe(MAP_CHROME_GAP);
    expect(MAP_CHROME.challengeHeight).toBe(CHALLENGE_CARD_HEIGHT);
    expect(MAP_CHROME.nudgeHeight).toBe(NUDGE_CARD_HEIGHT);
    expect(MAP_CHROME.badgeSize).toBe(INTERACTION_BADGE_SIZE);
    expect(MAP_CHROME.fabBottom).toBe(FAB_BOTTOM);
  });

  it('stacks challenge under safe area with gap', () => {
    expect(mapChallengeTop(insetsTop)).toBe(insetsTop + MAP_CHROME_GAP);
  });

  it('stacks nudge under challenge', () => {
    const challenge = mapChallengeTop(insetsTop);
    const nudge = mapNudgeTop(insetsTop);
    expect(nudge).toBe(challenge + CHALLENGE_CARD_HEIGHT + MAP_CHROME_GAP);
    expect(nudge).toBeGreaterThan(challenge);
  });

  it('stacks badge under nudge when sheet is closed', () => {
    const nudge = mapNudgeTop(insetsTop);
    const badge = mapBadgeTop(insetsTop, false);
    expect(badge).toBe(nudge + NUDGE_CARD_HEIGHT + MAP_CHROME_GAP);
    expect(badge).toBeGreaterThan(nudge);
  });

  it('lifts badge under safe area when sheet is open', () => {
    const closed = mapBadgeTop(insetsTop, false);
    const open = mapBadgeTop(insetsTop, true);
    expect(open).toBe(insetsTop + MAP_CHROME_GAP);
    expect(open).toBeLessThan(closed);
    expect(open).toBe(mapChallengeTop(insetsTop));
  });

  it('mapChromeTops preserves vertical order (closed sheet)', () => {
    const tops = mapChromeTops(insetsTop, false);
    expect(tops.challenge).toBeLessThan(tops.nudge);
    expect(tops.nudge).toBeLessThan(tops.badge);
  });

  it('mapChromeTops collapses top stack when sheet open', () => {
    const tops = mapChromeTops(insetsTop, true);
    expect(tops.badge).toBe(tops.challenge);
  });

  it('mapFabBottom adds safe area and optional offset', () => {
    expect(mapFabBottom(34)).toBe(FAB_BOTTOM + 34);
    expect(mapFabBottom(34, 88)).toBe(FAB_BOTTOM + 34 + 88);
  });

  it('uses matching card heights so stack math stays consistent', () => {
    // Regression lock: if DailyChallengeCard height drifts, update export + this.
    expect(CHALLENGE_CARD_HEIGHT).toBe(56);
    expect(NUDGE_CARD_HEIGHT).toBe(56);
  });
});
