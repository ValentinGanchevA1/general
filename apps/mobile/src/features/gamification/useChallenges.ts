// apps/mobile/src/features/gamification/useChallenges.ts
//
// Reads today's daily challenges + the user's progress from GET /challenges/today.

import { useCallback, useEffect } from 'react';
import { useFocusEffect } from '@react-navigation/native';

import type { ChallengeToday } from '@g88/shared';
import { getJson } from '@/api/client';
import { useAsyncResource } from '@/features/common/useAsyncResource';
import { challengeEvents } from './challengeEvents';

interface UseChallengesResult {
  challenges: ChallengeToday[];
  loading: boolean;
  error: unknown | null;
  refresh: () => void;
}

export function useChallenges(): UseChallengesResult {
  const { data, loading, error, refresh } = useAsyncResource<ChallengeToday[]>({
    resourceKey: 'challenges.today',
    fetcher: () => getJson<ChallengeToday[]>('/challenges/today'),
    initialData: [],
  });

  // Re-read when a challenge-affecting action fires (wave sent, alert posted).
  // The map banner lives in the never-unmounting MapScreen, so the mount-only
  // fetch above would otherwise stay frozen at its initial value.
  useEffect(() => challengeEvents.on('progress', refresh), [refresh]);

  // Re-read when the hosting screen (e.g. Map tab) regains focus, covering
  // returns from the Challenges screen or the alert composer.
  useFocusEffect(
    useCallback(() => {
      refresh();
    }, [refresh]),
  );

  return { challenges: data, loading, error, refresh };
}
