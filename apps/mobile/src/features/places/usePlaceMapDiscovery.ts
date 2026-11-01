import {
  useCallback,
  useEffect,
  useRef,
  useState,
  useSyncExternalStore,
} from 'react';
import { useIsFocused } from '@react-navigation/native';
import axios from 'axios';

import type { DiscoveryRankBy, MapDiscoveryResponse, Viewport } from '@g88/shared';

import { postJson } from '@/api/client';
import { useAppDispatch } from '@/hooks/redux';
import { mapDiscoveryRankStore } from '@/features/map/mapDiscoveryRank.store';
import {
  clearPlaceMapNewCount,
  setPlaceMapNewCount,
} from '@/features/map/mapNoveltySlice';
import { extractMessage } from '@/utils/extractMessage';
import { normalizePlaceMapSearch } from './placeMapSearch';
import {
  countUnseenPublicPlaces,
  loadSeenPublicPlaceKeys,
  mergeSeenPublicPlaceKeys,
  saveSeenPublicPlaceKeys,
} from './publicPlaceNovelty';
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
  rankBy?: DiscoveryRankBy;
}

const NOVELTY_SEEN_DWELL_MS = 1200;

export function usePlaceMapDiscovery({
  viewport,
  zoom,
  enabled,
  query = '',
  debounceMs = 250,
}: Args): Result {
  const dispatch = useAppDispatch();
  const mapFocused = useIsFocused();
  const [data, setData] = useState<MapDiscoveryResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [seenPlaceReady, setSeenPlaceReady] = useState(false);
  const abortRef = useRef<AbortController | null>(null);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const lastKeyRef = useRef('');
  const seenPlaceKeysRef = useRef<Set<string>>(new Set());
  const normalizedQuery = normalizePlaceMapSearch(query);
  const rankBy = useSyncExternalStore(
    mapDiscoveryRankStore.subscribe,
    mapDiscoveryRankStore.getSnapshot,
    mapDiscoveryRankStore.getSnapshot,
  );

  const fetchNow = useCallback(async (
    nextViewport: Viewport,
    nextZoom: number,
    nextQuery: string,
    nextRankBy: DiscoveryRankBy,
  ) => {
    const key = JSON.stringify({
      viewport: nextViewport,
      zoom: nextZoom,
      query: nextQuery,
      rankBy: nextRankBy,
    });
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
          ...(nextRankBy !== 'relevance' ? { rankBy: nextRankBy } : {}),
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
    let active = true;
    void loadSeenPublicPlaceKeys().then((keys) => {
      if (!active) return;
      seenPlaceKeysRef.current = keys;
      setSeenPlaceReady(true);
    });
    return () => {
      active = false;
    };
  }, []);

  useEffect(() => {
    if (timerRef.current) clearTimeout(timerRef.current);
    if (!enabled || viewport == null) {
      abortRef.current?.abort();
      abortRef.current = null;
      lastKeyRef.current = '';
      publicPlaceTrendingStore.clear();
      dispatch(clearPlaceMapNewCount());
      return undefined;
    }

    abortRef.current?.abort();
    abortRef.current = null;
    lastKeyRef.current = '';
    timerRef.current = setTimeout(() => {
      void fetchNow(viewport, zoom, normalizedQuery, rankBy);
    }, debounceMs);

    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, [debounceMs, dispatch, enabled, fetchNow, normalizedQuery, rankBy, viewport, zoom]);

  useEffect(() => {
    if (!enabled || data == null) {
      if (!enabled) publicPlaceTrendingStore.clear();
      return;
    }
    publicPlaceTrendingStore.setFromDiscovery(data.points);
  }, [data, enabled]);

  useEffect(() => {
    if (!enabled) {
      dispatch(clearPlaceMapNewCount());
      return undefined;
    }
    if (!seenPlaceReady || loading || data == null) return undefined;

    const { count, keys } = countUnseenPublicPlaces(
      data.points,
      seenPlaceKeysRef.current,
    );

    if (!mapFocused) {
      dispatch(setPlaceMapNewCount(count));
      return undefined;
    }

    dispatch(clearPlaceMapNewCount());
    if (keys.length === 0) return undefined;

    const dwellTimer = setTimeout(() => {
      const merged = mergeSeenPublicPlaceKeys(seenPlaceKeysRef.current, keys);
      seenPlaceKeysRef.current = merged;
      void saveSeenPublicPlaceKeys(merged);
    }, NOVELTY_SEEN_DWELL_MS);

    return () => clearTimeout(dwellTimer);
  }, [data, dispatch, enabled, loading, mapFocused, seenPlaceReady]);

  useEffect(() => () => {
    abortRef.current?.abort();
    publicPlaceTrendingStore.clear();
    dispatch(clearPlaceMapNewCount());
  }, [dispatch]);

  const refresh = useCallback(() => {
    if (!enabled || viewport == null) return;
    lastKeyRef.current = '';
    void fetchNow(viewport, zoom, normalizedQuery, rankBy);
  }, [enabled, fetchNow, normalizedQuery, rankBy, viewport, zoom]);

  return {
    data: enabled ? data : null,
    loading: enabled ? loading : false,
    error: enabled ? error : null,
    refresh,
  };
}
