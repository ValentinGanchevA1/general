// Shared layout math for map chrome (top stack + bottom clearance).

import { CHALLENGE_CARD_HEIGHT } from '@/features/gamification/DailyChallengeCard';
import { spacing } from '@/theme';

export const MAP_CHROME_GAP = 8;
export const NUDGE_CARD_HEIGHT = 56;
export const INTERACTION_BADGE_SIZE = 44;
export const MAP_CHROME_H_INSET = spacing.lg;
export const FAB_BOTTOM = spacing.md;
export const EVENTS_RAIL_BOTTOM = spacing.lg;
/** @deprecated Prefer COMBINED_FILTER_ROW_HEIGHT — kept for any residual callers. */
export const LISTING_MODE_FILTER_HEIGHT = 40;
export const MAP_SEARCH_BAR_HEIGHT = 44;
/** Single row height for Search | Category chips. */
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

export function mapChallengeTop(insetsTop: number): number {
	return insetsTop + MAP_CHROME_GAP;
}

export function mapNudgeTop(insetsTop: number): number {
	return mapChallengeTop(insetsTop) + CHALLENGE_CARD_HEIGHT + MAP_CHROME_GAP;
}

export function mapBadgeTop(insetsTop: number, sheetOpen: boolean): number {
	if (sheetOpen) return insetsTop + MAP_CHROME_GAP;
	return mapNudgeTop(insetsTop) + NUDGE_CARD_HEIGHT + MAP_CHROME_GAP;
}

/**
 * Top of the combined Search + CategoryFilter row.
 * Sheet-aware: when sheet is open, sits under the lifted badge (no challenge/nudge gap).
 */
export function mapFilterRowTop(insetsTop: number, sheetOpen: boolean): number {
	return mapBadgeTop(insetsTop, sheetOpen) + INTERACTION_BADGE_SIZE + MAP_CHROME_GAP;
}

/**
 * Top of TrendingCard under the combined filter row.
 * Sheet-aware so the card does not leave a gap when challenge/nudge are hidden.
 */
export function mapTrendingTop(insetsTop: number, sheetOpen: boolean): number {
	return mapFilterRowTop(insetsTop, sheetOpen) + COMBINED_FILTER_ROW_HEIGHT + MAP_CHROME_GAP;
}

/** @deprecated Use mapFilterRowTop(insetsTop, sheetOpen). Ignores sheetOpen. */
export function mapSearchBarTop(insetsTop: number): number {
	return mapBadgeTop(insetsTop, false) + INTERACTION_BADGE_SIZE + MAP_CHROME_GAP;
}

/** @deprecated Use mapFilterRowTop(insetsTop, sheetOpen). Ignores sheetOpen. */
export function mapListingModeFilterTop(insetsTop: number): number {
	return mapSearchBarTop(insetsTop) + MAP_SEARCH_BAR_HEIGHT + MAP_CHROME_GAP;
}

export function mapFabBottom(insetsBottom: number, bottomOffset = 0): number {
	return FAB_BOTTOM + insetsBottom + bottomOffset;
}

export function mapChromeTops(
	insetsTop: number,
	sheetOpen: boolean,
): { challenge: number; nudge: number; badge: number } {
	return {
		challenge: mapChallengeTop(insetsTop),
		nudge: mapNudgeTop(insetsTop),
		badge: mapBadgeTop(insetsTop, sheetOpen),
	};
}
