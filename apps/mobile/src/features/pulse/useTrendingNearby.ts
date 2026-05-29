import { useEffect, useRef, useState } from 'react';

import type { TrendingResponse } from '@g88/shared';
import { computeH3Cells } from '@g88/shared';
import { getJson } from '@/api/client';
import { useUserLocation } from '@/features/location/useUserLocation';

const REFRESH_MS = 5 * 60 * 1_000;

export function useTrendingNearby(): { topics: string[]; loading: boolean } {
  const { coords } = useUserLocation();
  const [topics, setTopics] = useState<string[]>([]);
  const [loading, setLoading] = useState(false);
  const prevCellRef = useRef<string | null>(null);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    if (!coords) return;

    // Only re-fetch when the user crosses into a different H3 r7 cell.
    const cell = computeH3Cells(coords.lat, coords.lng).r7;
    if (cell === prevCellRef.current && timerRef.current !== null) return;
    prevCellRef.current = cell;

    const doFetch = async () => {
      setLoading(true);
      try {
        const res = await getJson<TrendingResponse>(
          `/trending/nearby?lat=${coords.lat}&lng=${coords.lng}`,
        );
        setTopics(res.topics);
      } catch {
        // keep stale topics on error — no flash of empty strip
      } finally {
        setLoading(false);
      }
    };

    void doFetch();

    if (timerRef.current) clearInterval(timerRef.current);
    timerRef.current = setInterval(() => void doFetch(), REFRESH_MS);

    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
      timerRef.current = null;
    };
  // coords object reference changes every 30 s; depend on cell to avoid
  // spurious fetches for sub-cell movements.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [coords?.lat, coords?.lng]);

  return { topics, loading };
}
