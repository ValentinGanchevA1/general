// apps/mobile/src/features/gamification/useChallenges.ts
//
// Reads today's daily challenges + the user's progress from GET /challenges/today.

import { useCallback, useEffect, useState } from 'react';

import type { ChallengeToday } from '@g88/shared';
import { getJson } from '@/api/client';

interface UseChallengesResult {
  challenges: ChallengeToday[];
  loading: boolean;
  refresh: () => void;
}

export function useChallenges(): UseChallengesResult {
  const [challenges, setChallenges] = useState<ChallengeToday[]>([]);
  const [loading, setLoading] = useState(false);

  const refresh = useCallback(() => {
    void (async () => {
      setLoading(true);
      try {
        setChallenges(await getJson<ChallengeToday[]>('/challenges/today'));
      } catch {
        // keep stale data on error
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  useEffect(() => { refresh(); }, [refresh]);

  return { challenges, loading, refresh };
}
