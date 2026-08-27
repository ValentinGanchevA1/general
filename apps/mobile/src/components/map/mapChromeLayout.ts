// Shared layout math for map chrome (top stack + bottom clearance).
// Single source of truth — MapChrome / cards receive absolute offsets;
// they do not self-compute stacking.
//
// Top stack (safe-area → down):
//   1. DailyChallengeCard
//   2. NudgeBanner (streak / verification)
//   3. Interactions badge (👋)
// When entity sheet is open: challenge + nudge hidden → badge under safe area only.
//
// TrendingFilterBar removed. FAB removed from MapScreen (long-press create).
// ContextualFab still uses FAB_BOTTOM when mounted elsewhere.

import { CHALLENGE_CARD_HEIGHT } from '@/features/gamification/DailyChallengeCard';
import { spacing } from '@/theme';

/** Vertical gap between stacked top chrome pieces. */
export const MAP_CHROME_GAP = 8;

/** Approx height of NudgeBanner (matches DailyChallengeCard rhythm). */
export const NUDGE_CARD_HEIGHT = 56;

/** Interaction badge diameter (layout only). */
export const INTERACTION_BADGE_SIZE = 44;

/** Horizontal inset for top cards and badge right edge. */
export const MAP_CHROME_H_INSET = spacing.lg; // 16

/**
 * Minimum clearance above tab bar for bottom-right controls (FAB legacy).
 * MapScreen no longer mounts ContextualFab; value kept for other hosts.
 */
export const FAB_BOTTOM = spacing.md; // 12

/** Events rail bottom offset from screen bottom (not safe-area). */
export const EVENTS_RAIL_BOTTOM = spacing.lg; // 16

/** Named bundle for hosts that prefer one import. */
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

/**
 * Top offset for the interactions badge.
 * When the entity sheet is open, challenge + nudge are hidden → badge sits under safe area only.
 */
export function mapBadgeTop(insetsTop: number, sheetOpen: boolean): number {
  if (sheetOpen) return insetsTop + MAP_CHROME_GAP;
  return mapNudgeTop(insetsTop) + NUDGE_CARD_HEIGHT + MAP_CHROME_GAP;
}

/**
 * Bottom offset for ContextualFab (tab safe area + optional sibling clearance).
 */
export function mapFabBottom(insetsBottom: number, bottomOffset = 0): number {
  return FAB_BOTTOM + insetsBottom + bottomOffset;
}

/** Absolute tops for the full top stack — useful in tests and debug. */
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
