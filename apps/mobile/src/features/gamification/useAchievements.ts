// Reads the achievement catalog merged with the caller's unlock/progress state
// from GET /achievements.
import type { AchievementStatus } from '@g88/shared';
import { getJson } from '@/api/client';
import { useAsyncResource } from '@/features/common/useAsyncResource';

interface UseAchievementsResult {
  achievements: AchievementStatus[];
  loading: boolean;
  error: unknown | null;
  refresh: () => void;
}

export function useAchievements(): UseAchievementsResult {
  const { data, loading, error, refresh } = useAsyncResource<AchievementStatus[]>({
    resourceKey: 'achievements.catalog',
    fetcher: () => getJson<AchievementStatus[]>('/achievements'),
    initialData: [],
  });

  return { achievements: data, loading, error, refresh };
}
