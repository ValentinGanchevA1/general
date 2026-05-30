import { useCallback, useEffect, useRef, useState } from 'react';
import axios from 'axios';

import {
  type DiscoveryResponse,
  type DiscoveryQuery,
  type DiscoveryPoint,
  type EntityKind,
  type Viewport,
} from '@g88/shared';

import { postJson } from '@/api/client';

interface UseDiscoveryArgs {
  zoom: number;
  viewport: Viewport | null;
  kinds?: EntityKind[];
  debounceMs?: number;
  enabled?: boolean;
}

interface UseDiscoveryResult {
  data: DiscoveryResponse | null;
  loading: boolean;
  error: string | null;
  refresh: () => void;
}

function pointKey(p: DiscoveryPoint): string {
  return p.kind === 'cluster' ? p.cellId : p.id;
}

/**
 * Viewport-driven discovery with viewport-diff (M1).
 *
 * First request: sends viewport + zoom, receives full point set.
 * Subsequent requests: sends prevViewportHash from last response.
 * Server returns a diff ({added, removed}) when the viewport overlaps
 * the previous one; the hook merges it into the cached point set.
 * Falls back to full replace when diff is absent or null.
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
  // Hash from the last successful response — sent as prevViewportHash next time.
  const prevHashRef = useRef<string | null>(null);
  // Cached point set updated incrementally by diffs.
  const cachedPointsRef = useRef<DiscoveryPoint[]>([]);

  const fetchNow = useCallback(
    async (vp: Viewport, z: number, k?: EntityKind[]) => {
      const key = JSON.stringify({ vp, z, k });
      if (key === lastFetchKey.current) return;
      lastFetchKey.current = key;

      abortRef.current?.abort();
      const ctrl = new AbortController();
      abortRef.current = ctrl;

      setLoading(true);
      setError(null);

      try {
        const body: DiscoveryQuery = {
          viewport: vp,
          zoom: z,
          ...(k ? { kinds: k } : {}),
          ...(prevHashRef.current ? { prevViewportHash: prevHashRef.current } : {}),
        };

        const res = await postJson<DiscoveryQuery, DiscoveryResponse>(
          '/discovery/nearby',
          body,
          { signal: ctrl.signal },
        );

        if (ctrl.signal.aborted) return;

        prevHashRef.current = res.viewportHash;

        if (res.diff) {
          // Incremental update — apply diff to cached point set.
          const removedSet = new Set(res.diff.removed);
          const kept = cachedPointsRef.current.filter((p) => !removedSet.has(pointKey(p)));
          const merged = [...res.diff.added, ...kept];
          cachedPointsRef.current = merged;
          // Expose a synthetic full response so consumers are diff-unaware.
          setData({ ...res, points: merged, diff: null });
        } else {
          // Full response — replace.
          cachedPointsRef.current = res.points;
          setData(res);
        }
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
    lastFetchKey.current = '';
    prevHashRef.current = null;   // force full response on explicit refresh
    cachedPointsRef.current = [];
    void fetchNow(viewport, zoom, kinds);
  }, [viewport, zoom, kinds, fetchNow]);

  return { data, loading, error, refresh };
}
