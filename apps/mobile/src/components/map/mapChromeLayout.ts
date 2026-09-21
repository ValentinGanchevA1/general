// Shared layout math for map chrome (top stack + bottom clearance).
// Stack (closed sheet): challenge → nudge → filter row → interactions badge → trending.
// Tops collapse when challenge/nudge are hidden.

import { CHALLENGE_CARD_HEIGHT } from '@/features/gamification/DailyChallengeCard';
import { spacing } from '@/theme';

export const MAP_CHROME_GAP = 8;
export const NUDGE_CARD_HEIGHT = 56;
export const INTERACTION_BADGE_SIZE = 44;
export const MAP_CHROME_H_INSET = spacing.lg;
export const FAB_BOTTOM = spacing.md;
export const EVENTS_RAIL_BOTTOM = spacing.lg;
/** @deprecated Prefer COMBINED_FILTER_ROW_HEIGHT — kept for residual callers. */
export const LISTING_MODE_FILTER_HEIGHT = 40;
export const MAP_SEARCH_BAR_HEIGHT = 44;
/** Single row: layer chips + search + sort. */
export const COMBINED_FILTER_ROW_HEIGHT = 44;

export const MAP_CHROME = {
	gap: MAP_CHROME_GAP,
	challengeHeight: CHALLENGE_CARD_HEIGHT,
	nudgeHeight: NUDGE_CARD_HEIGHT,
	badgeSize: INTERACTION_BADGE_SIZE,
	hInset: MAP_CHROME_H_INSET,
	fabBottom: FAB_BOTTOM,
	eventsRailBottom: EVENTS_RAIL_BOTTOM,
	searchBarHeight: MAP_SEARCH_BAR_HEIGHT,
	combinedFilterRowHeight: COMBINED_FILTER_ROW_HEIGHT,
} as const;

/** Which top-stack cards are actually mounted (not dismissed / not applicable). */
export interface MapTopStackVisibility {
	challengeVisible: boolean;
	nudgeVisible: boolean;
}

/** Default: reserve both slots (legacy callers / worst-case height). */
export const MAP_TOP_STACK_BOTH: MapTopStackVisibility = {
	challengeVisible: true,
	nudgeVisible: true,
};

export function mapChallengeTop(insetsTop: number): number {
	return insetsTop + MAP_CHROME_GAP;
}

/**
 * Nudge sits under challenge when challenge is visible; otherwise shares challenge top.
 */
export function mapNudgeTop(
	insetsTop: number,
	visibility: MapTopStackVisibility = MAP_TOP_STACK_BOTH,
): number {
	if (visibility.challengeVisible) {
		return mapChallengeTop(insetsTop) + CHALLENGE_CARD_HEIGHT + MAP_CHROME_GAP;
	}
	return mapChallengeTop(insetsTop);
}

/**
 * Top of the combined layer + search + sort row.
 * Under last visible challenge/nudge (not under interactions badge).
 * Sheet open → pinned under safe area.
 */
export function mapFilterRowTop(
	insetsTop: number,
	sheetOpen: boolean,
	visibility: MapTopStackVisibility = MAP_TOP_STACK_BOTH,
): number {
	if (sheetOpen) return insetsTop + MAP_CHROME_GAP;
	let y = insetsTop + MAP_CHROME_GAP;
	if (visibility.challengeVisible) {
		y += CHALLENGE_CARD_HEIGHT + MAP_CHROME_GAP;
	}
	if (visibility.nudgeVisible) {
		y += NUDGE_CARD_HEIGHT + MAP_CHROME_GAP;
	}
	return y;
}

/**
 * Interaction badge under the filter row.
 * Sheet open → under filter (still below safe area via filter top).
 */
export function mapBadgeTop(
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

/**
 * Top of TrendingCard under interactions badge.
 */
export function mapTrendingTop(
	insetsTop: number,
	sheetOpen: boolean,
	visibility: MapTopStackVisibility = MAP_TOP_STACK_BOTH,
): number {
	return (
		mapBadgeTop(insetsTop, sheetOpen, visibility) +
		INTERACTION_BADGE_SIZE +
		MAP_CHROME_GAP
	);
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
	trending: number;
} {
	return {
		challenge: mapChallengeTop(insetsTop),
		nudge: mapNudgeTop(insetsTop, visibility),
		filterRow: mapFilterRowTop(insetsTop, sheetOpen, visibility),
		badge: mapBadgeTop(insetsTop, sheetOpen, visibility),
		trending: mapTrendingTop(insetsTop, sheetOpen, visibility),
	};
}

export function mapFabBottom(insetsBottom: number, sheetLift = 0): number {
	return FAB_BOTTOM + insetsBottom + sheetLift;
}
