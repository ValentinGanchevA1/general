import { useCallback, useEffect, useMemo } from 'react';
import { useFocusEffect } from '@react-navigation/native';

import type { NexaSavedPlaceSummary, PlaceMapEntityPoint, Viewport } from '@g88/shared';

import { useAppDispatch, useAppSelector } from '@/hooks/redux';
import { loadSavedPlaces } from './placeDetailSlice';

const MAX_SAVED_MAP_ITEMS = 200;
const MAX_VISIBLE_SAVED_PINS = 120;

function longitudeInViewport(viewport: Viewport, lng: number): boolean {
  if (viewport.sw.lng <= viewport.ne.lng) {
    return lng >= viewport.sw.lng && lng <= viewport.ne.lng;
  }
  return lng >= viewport.sw.lng || lng <= viewport.ne.lng;
}

function isInsideViewport(viewport: Viewport, lat: number, lng: number): boolean {
  return lat >= viewport.sw.lat && lat <= viewport.ne.lat && longitudeInViewport(viewport, lng);
}

export function savedPlacesToMapPoints(
  items: readonly NexaSavedPlaceSummary[],
  viewport: Viewport | null,
): PlaceMapEntityPoint[] {
  if (viewport == null) return [];

  return items
    .filter((item) => isInsideViewport(
      viewport,
      item.approximateLocation.lat,
      item.approximateLocation.lng,
    ))
    .slice(0, MAX_VISIBLE_SAVED_PINS)
    .map((item) => ({
      kind: 'place' as const,
      id: item.id,
      lat: item.approximateLocation.lat,
      lng: item.approximateLocation.lng,
      meta: {
        canonicalLabel: item.canonicalLabel,
        trending: item.trending,
        recentActivityAt: item.recentActivityAt,
        locationPrecision: 'coarse' as const,
        saved: true,
      },
    }));
}

export function useSavedPlacesMapOverlay({
  enabled,
  viewport,
}: {
  enabled: boolean;
  viewport: Viewport | null;
}): PlaceMapEntityPoint[] {
  const dispatch = useAppDispatch();
  const saved = useAppSelector((state) => state.places.saved);

  useFocusEffect(useCallback(() => {
    if (!enabled) return;
    void dispatch(loadSavedPlaces({ reset: true }));
  }, [dispatch, enabled]));

  useEffect(() => {
    if (!enabled) return;
    if (saved.loadId != null || saved.error != null) return;
    if (saved.receivedAt <= 0 || saved.nextOffset == null) return;
    if (saved.items.length >= MAX_SAVED_MAP_ITEMS) return;
    void dispatch(loadSavedPlaces({ reset: false }));
  }, [dispatch, enabled, saved.error, saved.items.length, saved.loadId, saved.nextOffset, saved.receivedAt]);

  return useMemo(
    () => enabled ? savedPlacesToMapPoints(saved.items, viewport) : [],
    [enabled, saved.items, viewport],
  );
}
