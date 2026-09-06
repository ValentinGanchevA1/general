// Shared layout math for map chrome (top stack + bottom clearance).

import { CHALLENGE_CARD_HEIGHT } from '@/features/gamification/DailyChallengeCard';
import { spacing } from '@/theme';

export const MAP_CHROME_GAP = 8;
export const NUDGE_CARD_HEIGHT = 56;
export const INTERACTION_BADGE_SIZE = 44;
export const MAP_CHROME_H_INSET = spacing.lg;
export const FAB_BOTTOM = spacing.md;
export const EVENTS_RAIL_BOTTOM = spacing.lg;
export const LISTING_MODE_FILTER_HEIGHT = 40;

export const MAP_CHROME = {
  gap: MAP_CHROME_GAP,
  challengeHeight: CHALLENGE_CARD_HEIGHT,
  nudgeHeight: NUDGE_CARD_HEIGHT,
  badgeSize: INTERACTION_BADGE_SIZE,
  hInset: MAP_CHROME_H_INSET,
  fabBottom: FAB_BOTTOM,
  eventsRailBottom: EVENTS_RAIL_BOTTOM,
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

/** Listing mode chips sit under the interactions badge row. */
export function mapListingModeFilterTop(insetsTop: number): number {
  return mapBadgeTop(insetsTop, false) + INTERACTION_BADGE_SIZE + MAP_CHROME_GAP;
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
