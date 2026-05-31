// Reads the ranked leaderboard + the caller's own rank from
// GET /gamification/leaderboard?scope=weekly|all_time.
import { useCallback, useEffect, useState } from 'react';

import type { LeaderboardPage, LeaderboardScope } from '@g88/shared';
import { getJson } from '@/api/client';

interface UseLeaderboardResult {
  page: LeaderboardPage | null;
  loading: boolean;
  refresh: () => void;
}

export function useLeaderboard(scope: LeaderboardScope): UseLeaderboardResult {
  const [page, setPage] = useState<LeaderboardPage | null>(null);
  const [loading, setLoading] = useState(false);

  const refresh = useCallback(() => {
    void (async () => {
      setLoading(true);
      try {
        setPage(await getJson<LeaderboardPage>(`/gamification/leaderboard?scope=${scope}`));
      } catch {
        // keep stale data on error
      } finally {
        setLoading(false);
      }
    })();
  }, [scope]);

  useEffect(() => {
    refresh();
  }, [refresh]);

  return { page, loading, refresh };
}
