// Shared layout math for NEXA map chrome (primary controls + supporting cards).
// Stack: search/layers → trending/weather row → challenge → nudge.
// Primary controls stay pinned under the safe area; supporting content is compact.

import { CHALLENGE_CARD_HEIGHT } from '@/features/gamification/DailyChallengeCard';
import { spacing } from '@/theme';

export const MAP_CHROME_GAP = 8;
export const NUDGE_CARD_HEIGHT = 52;
/** @deprecated Interactions is bottom-tab only; retained for compatibility/tests. */
export const INTERACTION_BADGE_SIZE = 44;
export const WEATHER_WIDGET_WIDTH = 80;
export const WEATHER_WIDGET_HEIGHT = 56;
export const MAP_CHROME_H_INSET = spacing.lg;
export const FAB_BOTTOM = spacing.md;
export const EVENTS_RAIL_BOTTOM = spacing.lg;
/** @deprecated Kept for residual callers. */
export const LISTING_MODE_FILTER_HEIGHT = 40;
export const MAP_SEARCH_BAR_HEIGHT = 48;
export const MAP_LAYER_ROW_HEIGHT = 44;
export const COMBINED_FILTER_ROW_HEIGHT = MAP_SEARCH_BAR_HEIGHT + MAP_CHROME_GAP + MAP_LAYER_ROW_HEIGHT;

export const MAP_CHROME = {
	gap: MAP_CHROME_GAP,
	challengeHeight: CHALLENGE_CARD_HEIGHT,
	nudgeHeight: NUDGE_CARD_HEIGHT,
	badgeSize: INTERACTION_BADGE_SIZE,
	weatherWidth: WEATHER_WIDGET_WIDTH,
	weatherHeight: WEATHER_WIDGET_HEIGHT,
	hInset: MAP_CHROME_H_INSET,
	fabBottom: FAB_BOTTOM,
	eventsRailBottom: EVENTS_RAIL_BOTTOM,
	searchBarHeight: MAP_SEARCH_BAR_HEIGHT,
	layerRowHeight: MAP_LAYER_ROW_HEIGHT,
	combinedFilterRowHeight: COMBINED_FILTER_ROW_HEIGHT,
} as const;

export interface MapTopStackVisibility {
	challengeVisible: boolean;
	nudgeVisible: boolean;
}

export const MAP_TOP_STACK_BOTH: MapTopStackVisibility = { challengeVisible: true, nudgeVisible: true };

export function mapFilterRowTop(insetsTop: number, _sheetOpen: boolean, _visibility: MapTopStackVisibility = MAP_TOP_STACK_BOTH): number {
	return insetsTop + MAP_CHROME_GAP;
}

export function mapWeatherTop(insetsTop: number, sheetOpen: boolean, visibility: MapTopStackVisibility = MAP_TOP_STACK_BOTH): number {
	return mapFilterRowTop(insetsTop, sheetOpen, visibility) + COMBINED_FILTER_ROW_HEIGHT + MAP_CHROME_GAP;
}

/** @deprecated No floating interactions badge remains; shares the weather slot. */
export function mapBadgeTop(insetsTop: number, sheetOpen: boolean, visibility: MapTopStackVisibility = MAP_TOP_STACK_BOTH): number {
	return mapWeatherTop(insetsTop, sheetOpen, visibility);
}

export function mapTrendingTop(insetsTop: number, sheetOpen: boolean, visibility: MapTopStackVisibility = MAP_TOP_STACK_BOTH): number {
	return mapWeatherTop(insetsTop, sheetOpen, visibility);
}

export function mapChallengeTop(insetsTop: number): number {
	return mapFilterRowTop(insetsTop, false) + COMBINED_FILTER_ROW_HEIGHT + MAP_CHROME_GAP + WEATHER_WIDGET_HEIGHT + MAP_CHROME_GAP;
}

export function mapNudgeTop(insetsTop: number, visibility: MapTopStackVisibility = MAP_TOP_STACK_BOTH): number {
	return visibility.challengeVisible ? mapChallengeTop(insetsTop) + CHALLENGE_CARD_HEIGHT + MAP_CHROME_GAP : mapChallengeTop(insetsTop);
}

/** @deprecated Use mapFilterRowTop(insetsTop, sheetOpen, visibility). */
export function mapSearchBarTop(insetsTop: number): number { return mapFilterRowTop(insetsTop, false); }
/** @deprecated Use mapFilterRowTop. */
export function mapListingModeFilterTop(insetsTop: number): number { return mapSearchBarTop(insetsTop) + MAP_SEARCH_BAR_HEIGHT + MAP_CHROME_GAP; }
/** @deprecated Use mapTrendingTop(insetsTop, sheetOpen, visibility). */
export function mapTrendingCardTop(insetsTop: number): number { return mapTrendingTop(insetsTop, false); }

export function mapChromeTops(insetsTop: number, sheetOpen: boolean, visibility: MapTopStackVisibility = MAP_TOP_STACK_BOTH): { challenge: number; nudge: number; filterRow: number; badge: number; weather: number; trending: number } {
	return {
		challenge: mapChallengeTop(insetsTop),
		nudge: mapNudgeTop(insetsTop, visibility),
		filterRow: mapFilterRowTop(insetsTop, sheetOpen, visibility),
		badge: mapBadgeTop(insetsTop, sheetOpen, visibility),
		weather: mapWeatherTop(insetsTop, sheetOpen, visibility),
		trending: mapTrendingTop(insetsTop, sheetOpen, visibility),
	};
}

export function mapFabBottom(insetsBottom: number, sheetLift = 0): number {
	return FAB_BOTTOM + insetsBottom + sheetLift;
}
