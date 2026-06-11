// packages/shared/src/achievements.ts
//
// Achievement catalog (code-driven, like the challenge catalog) + leaderboard
// contracts. Definitions live here; the DB stores only unlocks. Progress is
// derived server-side from the gamification summary and the XP ledger — the
// client just renders what the API returns.

import type { XpReason } from './gamification';

export type AchievementKind = 'level' | 'streak' | 'count';

export interface AchievementDef {
  id: string;
  title: string;
  description: string;
  icon: string;                 // client maps to an asset/emoji
  kind: AchievementKind;
  /** Required only for kind: 'count' — which xp_events.reason to tally. */
  metric?: XpReason;
  threshold: number;            // value at which it unlocks
  rewardXp: number;             // bonus paid once on unlock (0 = cosmetic only)
}

export const ACHIEVEMENTS: readonly AchievementDef[] = [
  { id: 'streak3',  title: 'Getting Warm',       description: '3-day streak',        icon: '🔥', kind: 'streak', threshold: 3,  rewardXp: 30 },
  { id: 'streak7',  title: 'Regular',            description: '7-day streak',        icon: '🔥', kind: 'streak', threshold: 7,  rewardXp: 75 },
  { id: 'streak30', title: 'Local Legend',       description: '30-day streak',       icon: '🏅', kind: 'streak', threshold: 30, rewardXp: 300 },
  { id: 'level5',   title: 'Rising',             description: 'Reach level 5',       icon: '⭐', kind: 'level',  threshold: 5,  rewardXp: 50 },
  { id: 'level10',  title: 'Established',        description: 'Reach level 10',      icon: '🌟', kind: 'level',  threshold: 10, rewardXp: 150 },
  { id: 'waver10',  title: 'Friendly',           description: '10 waves waved back', icon: '👋', kind: 'count', metric: 'wave.reciprocated', threshold: 10, rewardXp: 60 },
  { id: 'scout5',   title: 'Neighborhood Watch', description: 'Post 5 area alerts',  icon: '📍', kind: 'count', metric: 'alert.posted',      threshold: 5,  rewardXp: 40 },
] as const;

/** An achievement merged with the caller's unlock/progress state. */
export interface AchievementStatus {
  id: string;
  title: string;
  description: string;
  icon: string;
  threshold: number;
  progress: number;             // capped at threshold
  unlocked: boolean;
  unlockedAt: string | null;    // ISO
}

export type LeaderboardScope = 'all_time' | 'weekly';

export interface LeaderboardEntry {
  rank: number;
  userId: string;
  displayName: string;
  avatarUrl: string | null;
  level: number;
  xp: number;                   // total (all-time) or weekly sum
  isMe: boolean;
}

export interface LeaderboardPage {
  scope: LeaderboardScope;
  entries: LeaderboardEntry[];
  me: LeaderboardEntry | null;  // caller's rank, even when off the top page
  /**
   * Weekly scope only: ISO time when the current weekly window rolls over
   * (next week boundary, server-computed to match the SUM window exactly).
   * Drives the reset-countdown ribbon. Omitted for all-time.
   */
  resetsAt?: string;
}
