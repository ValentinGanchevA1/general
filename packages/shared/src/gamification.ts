// packages/shared/src/gamification.ts
//
// XP / level / streak contracts shared between backend and mobile.
// Level curve: cumulative XP to *reach* level L = 50 * (L-1)^2.
//   L1=0  L2=50  L3=200  L4=450  L5=800  L6=1250 ...

export type XpReason = 'wave.reciprocated' | 'alert.posted' | 'trade.completed' | 'gift.received';

/** XP granted per action. */
export const XP_AMOUNTS: Record<XpReason, number> = {
  'wave.reciprocated': 50, // a wave waved back → a match/chat opens (both users)
  'alert.posted': 20,      // contributing an area alert
  'trade.completed': 100,  // reserved — trading flow not built yet
  'gift.received': 10,     // fixed reward for receiving a gift (capped below)
};

/** Per-day award cap by reason (omitted = uncapped). Prevents farming. */
export const XP_DAILY_CAP: Partial<Record<XpReason, number>> = {
  'alert.posted': 3,
  'gift.received': 5, // bounds XP minted into the economy by gift-trading
};

export interface GamificationSummary {
  totalXp: number;
  level: number;
  /** XP accumulated within the current level (0 .. xpForNextLevel). */
  xpIntoLevel: number;
  /** Total XP span of the current level. xpIntoLevel/xpForNextLevel = progress. */
  xpForNextLevel: number;
  currentStreak: number;
  longestStreak: number;
}

/** Level a given cumulative XP total maps to. Inverse of xpForLevel. */
export function levelForXp(totalXp: number): number {
  return Math.floor(Math.sqrt(Math.max(0, totalXp) / 50)) + 1;
}

/** Cumulative XP required to reach a level. */
export function xpForLevel(level: number): number {
  const l = Math.max(1, level);
  return 50 * (l - 1) * (l - 1);
}

/** Build a full summary from a raw XP total + streak counters. */
export function summaryForXp(
  totalXp: number,
  currentStreak: number,
  longestStreak: number,
): GamificationSummary {
  const level = levelForXp(totalXp);
  const base = xpForLevel(level);
  const next = xpForLevel(level + 1);
  return {
    totalXp,
    level,
    xpIntoLevel: totalXp - base,
    xpForNextLevel: next - base,
    currentStreak,
    longestStreak,
  };
}
