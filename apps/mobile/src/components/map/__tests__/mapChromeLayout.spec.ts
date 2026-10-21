import {
  CHALLENGE_CARD_HEIGHT,
} from '@/features/gamification/DailyChallengeCard';
import {
  COMBINED_FILTER_ROW_HEIGHT,
  FAB_BOTTOM,
  MAP_CHROME_GAP,
  MAP_LAYER_ROW_HEIGHT,
  MAP_SEARCH_BAR_HEIGHT,
  NUDGE_CARD_HEIGHT,
  WEATHER_WIDGET_HEIGHT,
  mapBadgeTop,
  mapChallengeTop,
  mapChromeTops,
  mapFabBottom,
  mapFilterRowTop,
  mapNudgeTop,
  mapTrendingTop,
  mapWeatherTop,
  type MapTopStackVisibility,
} from '../mapChromeLayout';

const insetsTop = 47;
const BOTH: MapTopStackVisibility = { challengeVisible: true, nudgeVisible: true };
const NONE: MapTopStackVisibility = { challengeVisible: false, nudgeVisible: false };
const CHALLENGE_ONLY: MapTopStackVisibility = { challengeVisible: true, nudgeVisible: false };
const NUDGE_ONLY: MapTopStackVisibility = { challengeVisible: false, nudgeVisible: true };

describe('mapChromeLayout', () => {
  it('pins the primary chrome directly below the safe area', () => {
    const expected = insetsTop + MAP_CHROME_GAP;
    expect(mapFilterRowTop(insetsTop, false, BOTH)).toBe(expected);
    expect(mapFilterRowTop(insetsTop, false, NONE)).toBe(expected);
    expect(mapFilterRowTop(insetsTop, true, BOTH)).toBe(expected);
  });

  it('builds the primary stack from search, gap and layer controls', () => {
    expect(MAP_SEARCH_BAR_HEIGHT).toBe(48);
    expect(MAP_LAYER_ROW_HEIGHT).toBe(44);
    expect(COMBINED_FILTER_ROW_HEIGHT).toBe(
      MAP_SEARCH_BAR_HEIGHT + MAP_CHROME_GAP + MAP_LAYER_ROW_HEIGHT,
    );
    expect(COMBINED_FILTER_ROW_HEIGHT).toBe(100);
  });

  it('places weather directly below the primary chrome', () => {
    const filter = mapFilterRowTop(insetsTop, false, BOTH);
    const weather = mapWeatherTop(insetsTop, false, BOTH);
    expect(weather).toBe(filter + COMBINED_FILTER_ROW_HEIGHT + MAP_CHROME_GAP);
    expect(mapBadgeTop(insetsTop, false, BOTH)).toBe(weather);
  });

  it('docks trending on the same row as weather regardless of optional cards', () => {
    const weather = mapWeatherTop(insetsTop, false, BOTH);
    expect(mapTrendingTop(insetsTop, false, NONE)).toBe(weather);
    expect(mapTrendingTop(insetsTop, false, CHALLENGE_ONLY)).toBe(weather);
    expect(mapTrendingTop(insetsTop, false, NUDGE_ONLY)).toBe(weather);
    expect(mapTrendingTop(insetsTop, false, BOTH)).toBe(weather);
  });

  it('places challenge below the shared trending/weather row', () => {
    const weather = mapWeatherTop(insetsTop, false, BOTH);
    expect(mapChallengeTop(insetsTop)).toBe(
      weather + WEATHER_WIDGET_HEIGHT + MAP_CHROME_GAP,
    );
  });

  it('stacks nudge after challenge only when challenge is visible', () => {
    const challenge = mapChallengeTop(insetsTop);
    expect(mapNudgeTop(insetsTop, CHALLENGE_ONLY)).toBe(
      challenge + CHALLENGE_CARD_HEIGHT + MAP_CHROME_GAP,
    );
    expect(mapNudgeTop(insetsTop, NUDGE_ONLY)).toBe(challenge);
  });

  it('mapChromeTops exposes trending and weather as horizontal peers', () => {
    const tops = mapChromeTops(insetsTop, false, BOTH);
    expect(tops.filterRow).toBeLessThan(tops.weather);
    expect(tops.trending).toBe(tops.weather);
    expect(tops.weather).toBeLessThan(tops.challenge);
    expect(tops.challenge).toBeLessThan(tops.nudge);
  });

  it('mapFabBottom adds safe area and optional offset', () => {
    expect(mapFabBottom(34)).toBe(FAB_BOTTOM + 34);
    expect(mapFabBottom(34, 88)).toBe(FAB_BOTTOM + 34 + 88);
  });

  it('uses matching supporting card heights so stack math stays consistent', () => {
    expect(CHALLENGE_CARD_HEIGHT).toBe(52);
    expect(NUDGE_CARD_HEIGHT).toBe(52);
  });
});
