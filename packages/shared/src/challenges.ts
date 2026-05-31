// packages/shared/src/challenges.ts
//
// Daily challenges ("quests"). A fixed catalog; 3 are surfaced each day,
// chosen deterministically by date so every user sees the same set. Progress
// is tracked per-user per-day; completing one awards bonus XP via the ledger.

export type ChallengeMetric = 'wave_sent' | 'match_made' | 'alert_posted' | 'chat_sent';

export interface ChallengeDef {
  id: string;
  title: string;
  metric: ChallengeMetric;
  target: number;
  rewardXp: number;
}

/** A challenge merged with the caller's progress for today. */
export interface ChallengeToday {
  id: string;
  title: string;
  target: number;
  rewardXp: number;
  progress: number;
  completed: boolean;
}

export const CHALLENGE_CATALOG: readonly ChallengeDef[] = [
  { id: 'wave3',      title: 'Send 3 waves',        metric: 'wave_sent',    target: 3, rewardXp: 30 },
  { id: 'wave1',      title: 'Wave at someone',     metric: 'wave_sent',    target: 1, rewardXp: 10 },
  { id: 'match1',     title: 'Make a new match',    metric: 'match_made',   target: 1, rewardXp: 50 },
  { id: 'alert1',     title: 'Post an area alert',  metric: 'alert_posted', target: 1, rewardXp: 20 },
  { id: 'alert2',     title: 'Post 2 area alerts',  metric: 'alert_posted', target: 2, rewardXp: 35 },
  { id: 'chat5',      title: 'Send 5 messages',     metric: 'chat_sent',    target: 5, rewardXp: 25 },
] as const;

export const DAILY_CHALLENGE_COUNT = 3;

/** Days since the Unix epoch for a YYYY-MM-DD string (UTC). */
function dayNumber(dateISO: string): number {
  return Math.floor(Date.parse(`${dateISO}T00:00:00Z`) / 86_400_000);
}

/**
 * The 3 challenges for a given day (YYYY-MM-DD, UTC). Deterministic: a small
 * seeded shuffle keyed on the day number, so the set is stable for everyone
 * that day and rotates over time.
 */
export function dailyChallenges(dateISO: string): ChallengeDef[] {
  const idx = CHALLENGE_CATALOG.map((_, i) => i);
  let seed = dayNumber(dateISO) || 1;
  // Seeded Fisher–Yates (LCG: Numerical Recipes constants).
  for (let i = idx.length - 1; i > 0; i--) {
    seed = (seed * 1664525 + 1013904223) >>> 0;
    const j = seed % (i + 1);
    [idx[i], idx[j]] = [idx[j]!, idx[i]!];
  }
  return idx.slice(0, DAILY_CHALLENGE_COUNT).map((i) => CHALLENGE_CATALOG[i]!);
}
