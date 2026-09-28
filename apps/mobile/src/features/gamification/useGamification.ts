// apps/mobile/src/features/gamification/useGamification.ts
//
// Reads the signed-in user's XP / level / streak from GET /gamification/me,
// and exposes pingGamification() to advance the daily streak on app foreground.

import type { GamificationSummary } from '@g88/shared';
import { getJson, api } from '@/api/client';
import { useAsyncResource } from '@/features/common/useAsyncResource';

interface UseGamificationResult {
  summary: GamificationSummary | null;
  loading: boolean;
  error: unknown | null;
  refresh: () => void;
}

export function useGamification(): UseGamificationResult {
  const { data, loading, error, refresh } = useAsyncResource<GamificationSummary | null>({
    resourceKey: 'gamification.me',
    fetcher: () => getJson<GamificationSummary>('/gamification/me'),
    initialData: null,
  });

  return { summary: data, loading, error, refresh };
}

/**
 * Advance the daily streak. Fire-and-forget on app foreground / login.
 * Returns the fresh summary, or null on failure (never throws).
 */
export async function pingGamification(): Promise<GamificationSummary | null> {
  try {
    const res = await api.post<GamificationSummary>('/gamification/ping');
    return res.data;
  } catch {
    return null;
  }
}
