import { useCallback, useEffect, useState } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';

import { track } from '@/lib/analytics';

/** Coach must be finished before we offer the create nudge. */
const COACH_KEY = 'g88:map_coach_v1';
/** Permanent dismiss after Create or Not now. */
const NUDGE_KEY = 'g88:map_create_nudge_v1';

/**
 * First-session map create banner.
 * Shows at most once when coach is done, map is empty, and user has not dismissed.
 */
export function useMapCreateNudge(opts: {
  mapReady: boolean;
  isEmpty: boolean;
  blocked: boolean;
}): {
  visible: boolean;
  dismiss: (reason: 'dismiss' | 'create') => void;
} {
  const { mapReady, isEmpty, blocked } = opts;
  const [eligible, setEligible] = useState(false);
  const [revealed, setRevealed] = useState(false);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      try {
        const [coach, nudge] = await Promise.all([
          AsyncStorage.getItem(COACH_KEY),
          AsyncStorage.getItem(NUDGE_KEY),
        ]);
        if (cancelled) return;
        // Coach not done yet → wait; already dismissed → never show.
        setEligible(coach === 'done' && nudge !== 'done');
      } catch {
        if (!cancelled) setEligible(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (!eligible || !mapReady || !isEmpty || blocked || revealed) return;
    const t = setTimeout(() => {
      setRevealed(true);
      track('map.create_nudge_shown');
    }, 1500);
    return () => clearTimeout(t);
  }, [eligible, mapReady, isEmpty, blocked, revealed]);

  const dismiss = useCallback((reason: 'dismiss' | 'create') => {
    setRevealed(false);
    setEligible(false);
    void AsyncStorage.setItem(NUDGE_KEY, 'done').catch(() => undefined);
    track('map.create_nudge_dismissed', { reason });
  }, []);

  return {
    visible: revealed && eligible && isEmpty && !blocked,
    dismiss,
  };
}
