// Shared vertical layout math for map top chrome.
// Single source of truth so badge / future overlays don't re-derive magic offsets.

import { CHALLENGE_CARD_HEIGHT } from '@/features/gamification/DailyChallengeCard';

/** Vertical gap between stacked top chrome pieces. */
export const MAP_CHROME_GAP = 8;

/** Approx height of NudgeBanner (matches DailyChallengeCard rhythm). */
export const NUDGE_CARD_HEIGHT = 56;

/** Interaction badge diameter (layout only). */
export const INTERACTION_BADGE_SIZE = 44;

/**
 * Top offset for the interactions badge.
 * When the entity sheet is open, challenge + nudge are hidden → badge sits under safe area only.
 */
export function mapBadgeTop(insetsTop: number, sheetOpen: boolean): number {
  if (sheetOpen) return insetsTop + MAP_CHROME_GAP;
  return (
    insetsTop +
    MAP_CHROME_GAP +
    CHALLENGE_CARD_HEIGHT +
    MAP_CHROME_GAP +
    NUDGE_CARD_HEIGHT +
    MAP_CHROME_GAP
  );
}
