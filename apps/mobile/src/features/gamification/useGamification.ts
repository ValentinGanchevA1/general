// apps/mobile/src/features/gamification/useGamification.ts
//
// Reads the signed-in user's XP / level / streak from GET /gamification/me,
// and exposes pingGamification() to advance the daily streak on app foreground.

import { useCallback, useEffect, useState } from 'react';

import type { GamificationSummary } from '@g88/shared';
import { getJson, api } from '@/api/client';

interface UseGamificationResult {
  summary: GamificationSummary | null;
  loading: boolean;
  refresh: () => void;
}

export function useGamification(): UseGamificationResult {
  const [summary, setSummary] = useState<GamificationSummary | null>(null);
  const [loading, setLoading] = useState(false);

  const refresh = useCallback(() => {
    void (async () => {
      setLoading(true);
      try {
        setSummary(await getJson<GamificationSummary>('/gamification/me'));
      } catch {
        // keep stale data on error
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  useEffect(() => { refresh(); }, [refresh]);

  return { summary, loading, refresh };
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
