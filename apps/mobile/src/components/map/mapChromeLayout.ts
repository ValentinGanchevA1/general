// Shared layout math for map chrome (top controls + supporting cards).
// Stack: filter row → weather/location → challenge → nudge → trending.
// Primary map controls stay pinned directly under the safe area and are never
// pushed down by optional challenge/nudge content.

import { CHALLENGE_CARD_HEIGHT } from '@/features/gamification/DailyChallengeCard';
import { spacing } from '@/theme';

export const MAP_CHROME_GAP = 8;
export const NUDGE_CARD_HEIGHT = 56;
/** @deprecated Interactions is bottom-tab only; retained for compatibility/tests. */
export const INTERACTION_BADGE_SIZE = 44;
export const WEATHER_WIDGET_WIDTH = 88;
export const WEATHER_WIDGET_HEIGHT = 64;
export const MAP_CHROME_H_INSET = spacing.lg;
export const FAB_BOTTOM = spacing.md;
export const EVENTS_RAIL_BOTTOM = spacing.lg;
/** @deprecated Prefer COMBINED_FILTER_ROW_HEIGHT — kept for residual callers. */
export const LISTING_MODE_FILTER_HEIGHT = 40;
export const MAP_SEARCH_BAR_HEIGHT = 44;
/** Single row: layer chips + fixed recenter control. */
export const COMBINED_FILTER_ROW_HEIGHT = 44;

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
	combinedFilterRowHeight: COMBINED_FILTER_ROW_HEIGHT,
} as const;

/** Which optional top-stack cards are actually mounted. */
export interface MapTopStackVisibility {
	challengeVisible: boolean;
	nudgeVisible: boolean;
}

/** Default: reserve both optional card slots for legacy callers. */
export const MAP_TOP_STACK_BOTH: MapTopStackVisibility = {
	challengeVisible: true,
	nudgeVisible: true,
};

/**
 * Primary controls are always the first map-owned row below the status/safe area.
 * `sheetOpen` and optional-card visibility are intentionally ignored.
 */
export function mapFilterRowTop(
	insetsTop: number,
	_sheetOpen: boolean,
	_visibility: MapTopStackVisibility = MAP_TOP_STACK_BOTH,
): number {
	return insetsTop + MAP_CHROME_GAP;
}

/** Weather/location recovery starts immediately below the primary control row. */
export function mapWeatherTop(
	insetsTop: number,
	sheetOpen: boolean,
	visibility: MapTopStackVisibility = MAP_TOP_STACK_BOTH,
): number {
	return (
		mapFilterRowTop(insetsTop, sheetOpen, visibility) +
		COMBINED_FILTER_ROW_HEIGHT +
		MAP_CHROME_GAP
	);
}

/** @deprecated No floating interactions badge remains; shares the weather slot. */
export function mapBadgeTop(
	insetsTop: number,
	sheetOpen: boolean,
	visibility: MapTopStackVisibility = MAP_TOP_STACK_BOTH,
): number {
	return mapWeatherTop(insetsTop, sheetOpen, visibility);
}

/** Optional challenge content starts below the weather/location row. */
export function mapChallengeTop(insetsTop: number): number {
	return (
		mapFilterRowTop(insetsTop, false) +
		COMBINED_FILTER_ROW_HEIGHT +
		MAP_CHROME_GAP +
		WEATHER_WIDGET_HEIGHT +
		MAP_CHROME_GAP
	);
}

/** Nudge follows challenge when present, otherwise uses the challenge slot. */
export function mapNudgeTop(
	insetsTop: number,
	visibility: MapTopStackVisibility = MAP_TOP_STACK_BOTH,
): number {
	if (visibility.challengeVisible) {
		return mapChallengeTop(insetsTop) + CHALLENGE_CARD_HEIGHT + MAP_CHROME_GAP;
	}
	return mapChallengeTop(insetsTop);
}

/** Trending follows the optional supporting-card stack. */
export function mapTrendingTop(
	insetsTop: number,
	_sheetOpen: boolean,
	visibility: MapTopStackVisibility = MAP_TOP_STACK_BOTH,
): number {
	let y = mapChallengeTop(insetsTop);
	if (visibility.challengeVisible) {
		y += CHALLENGE_CARD_HEIGHT + MAP_CHROME_GAP;
	}
	if (visibility.nudgeVisible) {
		y += NUDGE_CARD_HEIGHT + MAP_CHROME_GAP;
	}
	return y;
}

/** @deprecated Use mapFilterRowTop(insetsTop, sheetOpen, visibility). */
export function mapSearchBarTop(insetsTop: number): number {
	return mapFilterRowTop(insetsTop, false);
}

/** @deprecated Use mapFilterRowTop. */
export function mapListingModeFilterTop(insetsTop: number): number {
	return mapSearchBarTop(insetsTop) + MAP_SEARCH_BAR_HEIGHT + MAP_CHROME_GAP;
}

/** @deprecated Use mapTrendingTop(insetsTop, sheetOpen, visibility). */
export function mapTrendingCardTop(insetsTop: number): number {
	return mapListingModeFilterTop(insetsTop) + LISTING_MODE_FILTER_HEIGHT + MAP_CHROME_GAP;
}

export function mapChromeTops(
	insetsTop: number,
	sheetOpen: boolean,
	visibility: MapTopStackVisibility = MAP_TOP_STACK_BOTH,
): {
	challenge: number;
	nudge: number;
	filterRow: number;
	badge: number;
	weather: number;
	trending: number;
} {
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
