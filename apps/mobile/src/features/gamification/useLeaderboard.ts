// Reads the ranked leaderboard + the caller's own rank from
// GET /gamification/leaderboard?scope=weekly|all_time.
import { useCallback } from 'react';

import type { LeaderboardPage, LeaderboardScope } from '@g88/shared';
import { getJson } from '@/api/client';
import { useAsyncResource } from '@/features/common/useAsyncResource';

interface UseLeaderboardResult {
  page: LeaderboardPage | null;
  loading: boolean;
  error: unknown | null;
  refresh: () => void;
}

export function useLeaderboard(scope: LeaderboardScope): UseLeaderboardResult {
  const fetcher = useCallback(
    () => getJson<LeaderboardPage>(`/gamification/leaderboard?scope=${scope}`),
    [scope],
  );

  const { data, loading, error, refresh } = useAsyncResource<LeaderboardPage | null>({
    resourceKey: `gamification.leaderboard.${scope}`,
    fetcher,
    initialData: null,
  });

  return { page: data, loading, error, refresh };
}
