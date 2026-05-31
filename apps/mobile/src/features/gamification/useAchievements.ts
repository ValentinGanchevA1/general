// Reads the achievement catalog merged with the caller's unlock/progress state
// from GET /achievements.
import { useCallback, useEffect, useState } from 'react';

import type { AchievementStatus } from '@g88/shared';
import { getJson } from '@/api/client';

interface UseAchievementsResult {
  achievements: AchievementStatus[];
  loading: boolean;
  refresh: () => void;
}

export function useAchievements(): UseAchievementsResult {
  const [achievements, setAchievements] = useState<AchievementStatus[]>([]);
  const [loading, setLoading] = useState(false);

  const refresh = useCallback(() => {
    void (async () => {
      setLoading(true);
      try {
        setAchievements(await getJson<AchievementStatus[]>('/achievements'));
      } catch {
        // keep stale data on error
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  useEffect(() => {
    refresh();
  }, [refresh]);

  return { achievements, loading, refresh };
}
