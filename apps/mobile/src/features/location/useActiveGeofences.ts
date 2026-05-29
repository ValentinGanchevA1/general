// apps/mobile/src/features/location/useActiveGeofences.ts
//
// Fetches the calling user's active geofences from GET /geofences/me/active.
// Each item carries an `inside` flag: true when the user's current H3 r7 cell
// falls within the geofence's disk (computed server-side).
//
// This is the v1.5 contract for the ContextualFab upgrade (Q2 option a):
// pass `geofences` into useFabContext to let the FAB consider watched areas.

import { useEffect, useRef, useState } from 'react';

import type { GeofenceResponse } from '@g88/shared';
import { computeH3Cells } from '@g88/shared';
import { getJson } from '@/api/client';
import { useUserLocation } from './useUserLocation';

const REFRESH_MS = 5 * 60 * 1_000;

export function useActiveGeofences(): { geofences: GeofenceResponse[]; loading: boolean } {
  const { coords } = useUserLocation();
  const [geofences, setGeofences] = useState<GeofenceResponse[]>([]);
  const [loading, setLoading] = useState(false);
  const prevCellRef = useRef<string | null>(null);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    if (!coords) return;

    // Only re-fetch when the user crosses into a new H3 r7 cell — the `inside`
    // flags can't change while the user stays in the same cell.
    const cell = computeH3Cells(coords.lat, coords.lng).r7;
    if (cell === prevCellRef.current && timerRef.current !== null) return;
    prevCellRef.current = cell;

    const doFetch = async () => {
      setLoading(true);
      try {
        const data = await getJson<GeofenceResponse[]>('/geofences/me/active');
        setGeofences(data);
      } catch {
        // keep stale data on error
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
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [coords?.lat, coords?.lng]);

  return { geofences, loading };
}
