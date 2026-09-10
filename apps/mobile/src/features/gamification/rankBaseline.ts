/**
 * Shared rank watermark for AmbientToastHost rank-up synthesis.
 * Module singleton so logout/delete can clear it without importing the toast host.
 */

import type { LeaderboardScope } from '@g88/shared';

const lastRankByScope: Partial<Record<LeaderboardScope, number>> = {};
let rankBaselineReady = false;

export function getLastRank(scope: LeaderboardScope): number | undefined {
  return lastRankByScope[scope];
}

export function setLastRank(scope: LeaderboardScope, rank: number): void {
  lastRankByScope[scope] = rank;
}

export function isRankBaselineReady(): boolean {
  return rankBaselineReady;
}

export function markRankBaselineReady(): void {
  rankBaselineReady = true;
}

/** Clear rank watermark on session end so the next account cannot inherit a baseline. */
export function resetRankBaseline(): void {
  for (const key of Object.keys(lastRankByScope) as LeaderboardScope[]) {
    delete lastRankByScope[key];
  }
  rankBaselineReady = false;
}
