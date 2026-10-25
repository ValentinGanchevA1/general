import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import axios from 'axios';

import {
  applyDiscoveryDiff,
  getDiscoveryPointKey,
  isEntityZoom,
  type DiscoveryResponse,
  type DiscoveryQuery,
  type DiscoveryPoint,
  type DiscoveryRankBy,
  type EntityKind,
  type EntityPoint,
  type ListingMode,
  type Viewport,
} from '@g88/shared';

import { postJson } from '@/api/client';
import { useAppDispatch, useAppSelector } from '@/hooks/redux';
import {
  removePoint,
  setDiscoveryZoom,
  setPoints,
  upsertPoint,
} from '@/features/discovery/discoverySlice';
import { useSocket } from '@/realtime/useSocket';
import { extractMessage } from '@/utils/extractMessage';

interface UseDiscoveryArgs {
  zoom: number;
  viewport: Viewport | null;
  kinds?: EntityKind[];
  topic?: string | null;
  listingMode?: ListingMode | undefined;
  friendsOnly?: boolean;
  datingOnly?: boolean;
  rankBy?: DiscoveryRankBy;
  debounceMs?: number;
  enabled?: boolean;
}

interface UseDiscoveryResult {
  data: DiscoveryResponse | null;
  loading: boolean;
  error: string | null;
  refresh: () => void;
}

function isViewportTooLarge(vp: Viewport): boolean {
  const latSpan = Math.abs(vp.ne.lat - vp.sw.lat);
  const rawLng = vp.ne.lng - vp.sw.lng;
  const lngSpan = ((rawLng % 360) + 360) % 360;
  const lngNorm = lngSpan > 180 ? 360 - lngSpan : lngSpan;
  return latSpan > 15 || lngNorm > 15;
}

function isPointInViewport(point: EntityPoint, viewport: Viewport): boolean {
  const withinLatitude = point.lat >= viewport.sw.lat && point.lat <= viewport.ne.lat;
  if (!withinLatitude) return false;

  if (viewport.sw.lng <= viewport.ne.lng) {
    return point.lng >= viewport.sw.lng && point.lng <= viewport.ne.lng;
  }

  // Antimeridian-crossing viewport.
  return point.lng >= viewport.sw.lng || point.lng <= viewport.ne.lng;
}

function matchesRealtimeQuery(
  point: EntityPoint,
  viewport: Viewport,
  kinds: readonly EntityKind[] | undefined,
  listingMode: ListingMode | undefined,
  friendsOnly: boolean,
): boolean {
  if (!isPointInViewport(point, viewport)) return false;
  if (kinds != null && kinds.length > 0 && !kinds.includes(point.kind)) return false;

  if (friendsOnly) {
    return point.kind === 'user' && point.meta.isFriend === true;
  }

  if (listingMode != null && point.kind === 'listing') {
    return (point.meta.mode ?? 'sell') === listingMode;
  }

  return true;
}

export function useDiscovery({
  zoom,
  viewport,
  kinds,
  topic,
  listingMode,
  friendsOnly = false,
  datingOnly = false,
  rankBy = 'relevance',
  debounceMs = 250,
  enabled = true,
}: UseDiscoveryArgs): UseDiscoveryResult {
  const dispatch = useAppDispatch();
  const points = useAppSelector((state) => state.discovery.points);
  const { on } = useSocket();
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
  const lastFriendsOnlyRef = useRef(false);
  const lastDatingOnlyRef = useRef(false);
  const lastRankByRef = useRef<DiscoveryRankBy>('relevance');

  const fetchNow = useCallback(
    async (
      vp: Viewport,
      z: number,
      k?: EntityKind[],
      t?: string | null,
      lm?: ListingMode,
      fo?: boolean,
      dating?: boolean,
      rb?: DiscoveryRankBy,
    ) => {
      dispatch(setDiscoveryZoom(z));

      if (isViewportTooLarge(vp)) {
        abortRef.current?.abort();
        abortRef.current = null;
        lastFetchKey.current = '';
        prevHashRef.current = null;
        cachedPointsRef.current = [];
        dispatch(setPoints([]));
        setData({
          points: [],
          resolution: 0,
          generatedAt: new Date().toISOString(),
          viewportHash: 'too-large',
          diff: null,
        });
        setLoading(false);
        setError(null);
        return;
      }

      const effectiveRank = rb ?? 'relevance';
      const key = JSON.stringify({
        vp,
        z,
        k,
        t,
        lm: lm ?? null,
        fo: fo === true,
        dating: dating === true,
        rb: effectiveRank,
      });
      if (key === lastFetchKey.current) return;

      const topicChanged = lastTopicRef.current !== (t ?? null);
      const modeChanged = lastListingModeRef.current !== (lm ?? null);
      const friendsChanged = lastFriendsOnlyRef.current !== (fo === true);
      const datingChanged = lastDatingOnlyRef.current !== (dating === true);
      const rankChanged = lastRankByRef.current !== effectiveRank;
      if (topicChanged || modeChanged || friendsChanged || datingChanged || rankChanged) {
        prevHashRef.current = null;
        cachedPointsRef.current = [];
        lastTopicRef.current = t ?? null;
        lastListingModeRef.current = lm ?? null;
        lastFriendsOnlyRef.current = fo === true;
        lastDatingOnlyRef.current = dating === true;
        lastRankByRef.current = effectiveRank;
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
          ...(fo ? { friendsOnly: true } : {}),
          ...(dating ? { datingOnly: true } : {}),
          ...(effectiveRank !== 'relevance' ? { rankBy: effectiveRank } : {}),
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
          const merged = applyDiscoveryDiff(cachedPointsRef.current, res.diff);
          cachedPointsRef.current = merged;
          dispatch(setPoints(merged));
          setData({ ...res, points: merged, diff: null });
        } else {
          cachedPointsRef.current = res.points;
          dispatch(setPoints(res.points));
          setData(res);
        }
      } catch (err) {
        if (axios.isCancel(err) || ctrl.signal.aborted) return;
        setError(extractMessage(err, 'Discovery failed'));
      } finally {
        if (!ctrl.signal.aborted) setLoading(false);
        if (abortRef.current === ctrl) abortRef.current = null;
      }
    },
    [dispatch],
  );

  useEffect(() => {
    if (!enabled || !viewport) {
      if (debounceTimer.current) clearTimeout(debounceTimer.current);
      abortRef.current?.abort();
      abortRef.current = null;
      setLoading(false);
      return;
    }

    // A new valid query invalidates an in-flight response immediately. Waiting
    // until the next debounced fetch starts leaves a window where stale A data
    // can commit after the UI has already moved to query B.
    if (abortRef.current) {
      abortRef.current.abort();
      abortRef.current = null;
      lastFetchKey.current = '';
      setLoading(false);
    }

    if (debounceTimer.current) clearTimeout(debounceTimer.current);
    debounceTimer.current = setTimeout(() => {
      void fetchNow(viewport, zoom, kinds, topic, listingMode, friendsOnly, datingOnly, rankBy);
    }, debounceMs);
    return () => {
      if (debounceTimer.current) clearTimeout(debounceTimer.current);
    };
  }, [enabled, viewport, zoom, kinds, topic, listingMode, friendsOnly, datingOnly, rankBy, debounceMs, fetchNow]);

  useEffect(() => {
    return () => abortRef.current?.abort();
  }, []);

  useEffect(() => {
    // Clusters remain HTTP-authoritative. Topic and dating filters cannot be
    // reconstructed safely from the sanitized realtime point alone, so those
    // modes intentionally keep HTTP discovery as their only source for now.
    if (
      !enabled ||
      viewport == null ||
      !isEntityZoom(zoom) ||
      (topic != null && topic.trim() !== '') ||
      datingOnly
    ) {
      return;
    }

    const applyRealtimePoint = (point: EntityPoint): void => {
      const key = getDiscoveryPointKey(point);
      if (matchesRealtimeQuery(point, viewport, kinds, listingMode, friendsOnly)) {
        dispatch(upsertPoint(point));
      } else {
        dispatch(removePoint(key));
      }
    };

    const unsubscribeEnter = on('discovery:entity:enter', ({ point }) => {
      applyRealtimePoint(point);
    });
    const unsubscribeUpdate = on('discovery:entity:update', ({ point }) => {
      applyRealtimePoint(point);
    });
    const unsubscribeLeave = on('discovery:entity:leave', ({ key }) => {
      dispatch(removePoint(key));
    });

    return () => {
      unsubscribeEnter();
      unsubscribeUpdate();
      unsubscribeLeave();
    };
  }, [
    enabled,
    viewport,
    zoom,
    kinds,
    topic,
    listingMode,
    friendsOnly,
    datingOnly,
    on,
    dispatch,
  ]);

  const refresh = useCallback(() => {
    if (!viewport) return;
    lastFetchKey.current = '';
    prevHashRef.current = null;
    cachedPointsRef.current = [];
    void fetchNow(viewport, zoom, kinds, topic, listingMode, friendsOnly, datingOnly, rankBy);
  }, [viewport, zoom, kinds, topic, listingMode, friendsOnly, datingOnly, rankBy, fetchNow]);

  const canonicalData = useMemo<DiscoveryResponse | null>(() => {
    if (data == null) return null;
    return { ...data, points };
  }, [data, points]);

  return { data: canonicalData, loading, error, refresh };
}
