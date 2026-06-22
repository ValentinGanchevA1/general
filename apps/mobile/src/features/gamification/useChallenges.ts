// apps/mobile/src/features/gamification/useChallenges.ts
//
// Reads today's daily challenges + the user's progress from GET /challenges/today.

import { useCallback, useEffect, useState } from 'react';
import { useFocusEffect } from '@react-navigation/native';

import type { ChallengeToday } from '@g88/shared';
import { getJson } from '@/api/client';
import { challengeEvents } from './challengeEvents';

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

  // Re-read when a challenge-affecting action fires (wave sent, alert posted).
  // The map banner lives in the never-unmounting MapScreen, so the mount-only
  // fetch above would otherwise stay frozen at its initial value.
  useEffect(() => challengeEvents.on('progress', refresh), [refresh]);

  // Re-read when the hosting screen (e.g. Map tab) regains focus, covering
  // returns from the Challenges screen or the alert composer.
  useFocusEffect(refresh);

  return { challenges, loading, refresh };
}
