import { useCallback, useEffect, useRef, useState } from 'react';
import axios from 'axios';

import {
  type DiscoveryResponse,
  type DiscoveryQuery,
  type EntityKind,
  type Viewport,
} from '@g88/shared';

import { postJson } from '@/api/client';

interface UseDiscoveryArgs {
  /** Map zoom (0–22). Determines whether server returns clusters or entities. */
  zoom: number;
  /** Current visible viewport. Hook debounces updates internally. */
  viewport: Viewport | null;
  /** Optional kind filter. */
  kinds?: EntityKind[];
  /** Debounce window for viewport changes (ms). */
  debounceMs?: number;
  /** Auto-fetch on mount and viewport change. Default true. */
  enabled?: boolean;
}

interface UseDiscoveryResult {
  data: DiscoveryResponse | null;
  loading: boolean;
  error: string | null;
  /** Force a refetch ignoring debounce. */
  refresh: () => void;
}

/**
 * Viewport-driven discovery.
 *
 * Behaviors:
 *  • Debounces viewport changes by `debounceMs` (default 250ms) — map pans
 *    fire dozens of viewport updates per second; we batch.
 *  • Cancels the previous in-flight request when a new viewport arrives.
 *    The user shouldn't see stale data from a viewport they already left.
 *  • Holds onto the last successful payload during loading so the map
 *    stays populated while we refetch.
 *  • Surfaces a normalized error string for UI.
 */
export function useDiscovery({
  zoom,
  viewport,
  kinds,
  debounceMs = 250,
  enabled = true,
}: UseDiscoveryArgs): UseDiscoveryResult {
  const [data, setData] = useState<DiscoveryResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const debounceTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const abortRef = useRef<AbortController | null>(null);
  const lastFetchKey = useRef<string>('');

  const fetchNow = useCallback(
    async (vp: Viewport, z: number, k?: EntityKind[]) => {
      // Dedupe: same viewport + zoom + kinds → skip.
      const key = JSON.stringify({ vp, z, k });
      if (key === lastFetchKey.current) return;
      lastFetchKey.current = key;

      abortRef.current?.abort();
      const ctrl = new AbortController();
      abortRef.current = ctrl;

      setLoading(true);
      setError(null);

      try {
        const body: DiscoveryQuery = { viewport: vp, zoom: z, ...(k ? { kinds: k } : {}) };
        const res = await postJson<DiscoveryQuery, DiscoveryResponse>(
          '/discovery/nearby',
          body,
          { signal: ctrl.signal },
        );
        if (!ctrl.signal.aborted) setData(res);
      } catch (err) {
        if (axios.isCancel(err) || ctrl.signal.aborted) return;
        setError(err instanceof Error ? err.message : 'Discovery failed');
      } finally {
        if (!ctrl.signal.aborted) setLoading(false);
      }
    },
    [],
  );

  useEffect(() => {
    if (!enabled || !viewport) return;
    if (debounceTimer.current) clearTimeout(debounceTimer.current);
    debounceTimer.current = setTimeout(() => {
      void fetchNow(viewport, zoom, kinds);
    }, debounceMs);
    return () => {
      if (debounceTimer.current) clearTimeout(debounceTimer.current);
    };
  }, [enabled, viewport, zoom, kinds, debounceMs, fetchNow]);

  useEffect(() => {
    return () => abortRef.current?.abort();
  }, []);

  const refresh = useCallback(() => {
    if (!viewport) return;
    lastFetchKey.current = ''; // force
    void fetchNow(viewport, zoom, kinds);
  }, [viewport, zoom, kinds, fetchNow]);

  return { data, loading, error, refresh };
}
