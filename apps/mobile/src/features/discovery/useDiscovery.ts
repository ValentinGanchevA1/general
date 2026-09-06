import { useCallback, useEffect, useRef, useState } from 'react';
import axios from 'axios';

import {
  type DiscoveryResponse,
  type DiscoveryQuery,
  type DiscoveryPoint,
  type EntityKind,
  type ListingMode,
  type Viewport,
} from '@g88/shared';

import { postJson } from '@/api/client';

interface UseDiscoveryArgs {
  zoom: number;
  viewport: Viewport | null;
  kinds?: EntityKind[];
  topic?: string | null;
  /** Omit or undefined = all listing modes. */
  listingMode?: ListingMode | undefined;
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

export function useDiscovery({
  zoom,
  viewport,
  kinds,
  topic,
  listingMode,
  debounceMs = 250,
  enabled = true,
}: UseDiscoveryArgs): UseDiscoveryResult {
  const [data, setData] = useState<DiscoveryResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const debounceTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const abortRef = useRef<AbortController | null>(null);
  const lastFetchKey = useRef<string>('');
  const prevHashRef = useRef<string | null>(null);
  const cachedPointsRef = useRef<DiscoveryPoint[]>([]);
  const lastTopicRef = useRef<string | null>(null);
  const lastListingModeRef = useRef<string | null>(null);

  const fetchNow = useCallback(
    async (
      vp: Viewport,
      z: number,
      k?: EntityKind[],
      t?: string | null,
      lm?: ListingMode,
    ) => {
      const key = JSON.stringify({ vp, z, k, t, lm: lm ?? null });
      if (key === lastFetchKey.current) return;

      const topicChanged = lastTopicRef.current !== (t ?? null);
      const modeChanged = lastListingModeRef.current !== (lm ?? null);
      if (topicChanged || modeChanged) {
        prevHashRef.current = null;
        cachedPointsRef.current = [];
        lastTopicRef.current = t ?? null;
        lastListingModeRef.current = lm ?? null;
      }

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
          ...(t ? { topic: t } : {}),
          ...(lm ? { listingMode: lm } : {}),
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
          const removedSet = new Set(res.diff.removed);
          const kept = cachedPointsRef.current.filter((p) => !removedSet.has(pointKey(p)));
          const merged = [...res.diff.added, ...kept];
          cachedPointsRef.current = merged;
          setData({ ...res, points: merged, diff: null });
        } else {
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
      void fetchNow(viewport, zoom, kinds, topic, listingMode);
    }, debounceMs);
    return () => {
      if (debounceTimer.current) clearTimeout(debounceTimer.current);
    };
  }, [enabled, viewport, zoom, kinds, topic, listingMode, debounceMs, fetchNow]);

  useEffect(() => {
    return () => abortRef.current?.abort();
  }, []);

  const refresh = useCallback(() => {
    if (!viewport) return;
    lastFetchKey.current = '';
    prevHashRef.current = null;
    cachedPointsRef.current = [];
    void fetchNow(viewport, zoom, kinds, topic, listingMode);
  }, [viewport, zoom, kinds, topic, listingMode, fetchNow]);

  return { data, loading, error, refresh };
}
