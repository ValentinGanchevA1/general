import { useCallback, useEffect, useRef, useState } from 'react';
import axios from 'axios';

import type { MapDiscoveryResponse, Viewport } from '@g88/shared';

import { postJson } from '@/api/client';
import { extractMessage } from '@/utils/extractMessage';
import { normalizePlaceMapSearch } from './placeMapSearch';
import { publicPlaceTrendingStore } from './publicPlaceTrending.store';

interface Args {
  viewport: Viewport | null;
  zoom: number;
  enabled: boolean;
  query?: string;
  debounceMs?: number;
}

interface Result {
  data: MapDiscoveryResponse | null;
  loading: boolean;
  error: string | null;
  refresh: () => void;
}

interface PlaceDiscoveryRequest {
  viewport: Viewport;
  zoom: number;
  query?: string;
}

export function usePlaceMapDiscovery({
  viewport,
  zoom,
  enabled,
  query = '',
  debounceMs = 250,
}: Args): Result {
  const [data, setData] = useState<MapDiscoveryResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const abortRef = useRef<AbortController | null>(null);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const lastKeyRef = useRef('');
  const normalizedQuery = normalizePlaceMapSearch(query);

  const fetchNow = useCallback(async (
    nextViewport: Viewport,
    nextZoom: number,
    nextQuery: string,
  ) => {
    const key = JSON.stringify({ viewport: nextViewport, zoom: nextZoom, query: nextQuery });
    if (key === lastKeyRef.current) return;
    lastKeyRef.current = key;

    abortRef.current?.abort();
    const controller = new AbortController();
    abortRef.current = controller;
    setLoading(true);
    setError(null);

    try {
      const response = await postJson<PlaceDiscoveryRequest, MapDiscoveryResponse>(
        '/discovery/places',
        {
          viewport: nextViewport,
          zoom: nextZoom,
          ...(nextQuery !== '' ? { query: nextQuery } : {}),
        },
        { signal: controller.signal },
      );
      if (!controller.signal.aborted) setData(response);
    } catch (err: unknown) {
      if (axios.isCancel(err) || controller.signal.aborted) return;
      setError(extractMessage(err, 'Place discovery failed'));
    } finally {
      if (!controller.signal.aborted) setLoading(false);
      if (abortRef.current === controller) abortRef.current = null;
    }
  }, []);

  useEffect(() => {
    if (timerRef.current) clearTimeout(timerRef.current);
    if (!enabled || viewport == null) {
      abortRef.current?.abort();
      abortRef.current = null;
      lastKeyRef.current = '';
      publicPlaceTrendingStore.clear();
      return undefined;
    }

    abortRef.current?.abort();
    abortRef.current = null;
    lastKeyRef.current = '';
    timerRef.current = setTimeout(() => {
      void fetchNow(viewport, zoom, normalizedQuery);
    }, debounceMs);

    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, [debounceMs, enabled, fetchNow, normalizedQuery, viewport, zoom]);

  useEffect(() => {
    if (!enabled || data == null) {
      if (!enabled) publicPlaceTrendingStore.clear();
      return;
    }
    publicPlaceTrendingStore.setFromDiscovery(data.points);
  }, [data, enabled]);

  useEffect(() => () => {
    abortRef.current?.abort();
    publicPlaceTrendingStore.clear();
  }, []);

  const refresh = useCallback(() => {
    if (!enabled || viewport == null) return;
    lastKeyRef.current = '';
    void fetchNow(viewport, zoom, normalizedQuery);
  }, [enabled, fetchNow, normalizedQuery, viewport, zoom]);

  return {
    data: enabled ? data : null,
    loading: enabled ? loading : false,
    error: enabled ? error : null,
    refresh,
  };
}
