import React, { useCallback, useEffect, useRef } from 'react';
import { InteractionManager } from 'react-native';
import type MapView from 'react-native-maps';
import type { Region } from 'react-native-maps';
import { useFocusEffect } from '@react-navigation/native';
import type { NavigationProp, ParamListBase } from '@react-navigation/native';

import type { EntityPoint, ListingMode, VerificationLevel } from '@g88/shared';

import {
  clearPendingMapFocus,
  peekPendingMapFocus,
} from '@/navigation/pendingMapFocus';
import {
  approxDistanceMeters,
  buildPeerRegionFocus,
} from '@/components/map/focusPeerOnMap';
import type { ListingModeFilterValue } from '@/components/map/ListingModeFilter';

export type MapFocusParams = {
  focusMyPin?: boolean;
  focusUserId?: string;
  focusListingId?: string;
  focusLat?: number;
  focusLng?: number;
};

type PendingFocus = {
  userId?: string;
  listingId?: string;
  lat?: number;
  lng?: number;
  displayName?: string;
  avatarUrl?: string | null;
  verification?: VerificationLevel;
  online?: boolean;
  lastSeenAt?: string | null;
  title?: string;
  mode?: ListingMode;
  priceCents?: number;
  currency?: string;
  category?: string;
  thumbnailUrl?: string | null;
};

type LatLng = { lat: number; lng: number };

type Args = {
  mapRef: React.RefObject<MapView | null>;
  myCoords: LatLng | null;
  points: EntityPoint[];
  region: Region | null;
  setSelected: (p: EntityPoint | null) => void;
  setListingModeFilter: (v: ListingModeFilterValue) => void;
  navigation: NavigationProp<ParamListBase>;
  params: MapFocusParams;
};

/**
 * Orchestrates "View on map" / post-create pin focus:
 * route params + pendingMapFocus module → animate + optional entity select.
 */
export function useMapFocus({
  mapRef,
  myCoords,
  points,
  region,
  setSelected,
  setListingModeFilter,
  navigation,
  params,
}: Args): void {
  const {
    focusMyPin = false,
    focusUserId,
    focusListingId,
    focusLat,
    focusLng,
  } = params;

  const pendingFocusRef = useRef<PendingFocus | null>(null);
  const pendingFocusReaderRef = useRef(() => peekPendingMapFocus());
  const focusAppliedKeyRef = useRef<string | null>(null);

  const clearFocusParams = useCallback(() => {
    navigation.setParams({
      focusMyPin: undefined,
      focusUserId: undefined,
      focusListingId: undefined,
      focusLat: undefined,
      focusLng: undefined,
    } as never);
  }, [navigation]);

  const applyPeerFocus = useCallback(
    (lat: number, lng: number, point?: EntityPoint, token?: number) => {
      if (!Number.isFinite(lat) || !Number.isFinite(lng)) return;
      const distanceMeters =
        myCoords != null ? approxDistanceMeters(myCoords, { lat, lng }) : undefined;
      const { latitude, longitude, latitudeDelta, longitudeDelta, duration } =
        buildPeerRegionFocus({
          lat,
          lng,
          ...(distanceMeters != null ? { distanceMeters } : {}),
        });
      InteractionManager.runAfterInteractions(() => {
        mapRef.current?.animateToRegion(
          { latitude, longitude, latitudeDelta, longitudeDelta },
          duration,
        );
        if (point) {
          setTimeout(() => setSelected(point), Math.min(duration, 350));
        }
      });
      pendingFocusRef.current = null;
      clearPendingMapFocus(token);
      clearFocusParams();
    },
    [clearFocusParams, mapRef, myCoords, setSelected],
  );

  const buildSeedUserPoint = useCallback(
    (
      userId: string,
      lat: number,
      lng: number,
      seed: PendingFocus | null,
      fromPoints?: EntityPoint & { kind: 'user' },
    ): EntityPoint => {
      if (fromPoints) return fromPoints;
      return {
        kind: 'user',
        id: userId,
        lat,
        lng,
        meta: {
          displayName: seed?.displayName ?? 'User',
          avatarUrl: seed?.avatarUrl ?? null,
          verification: seed?.verification ?? 'none',
          online: seed?.online ?? false,
          lastSeenAt: seed?.lastSeenAt ?? null,
        },
      };
    },
    [],
  );

  const buildSeedListingPoint = useCallback(
    (
      listingId: string,
      lat: number,
      lng: number,
      seed: PendingFocus | null,
      fromPoints?: EntityPoint & { kind: 'listing' },
    ): EntityPoint => {
      if (fromPoints) return fromPoints;
      return {
        kind: 'listing',
        id: listingId,
        lat,
        lng,
        meta: {
          title: seed?.title ?? 'Listing',
          thumbnailUrl: seed?.thumbnailUrl ?? null,
          priceCents: seed?.priceCents ?? 0,
          currency: seed?.currency ?? 'USD',
          category: seed?.category ?? '',
          ...(seed?.mode != null ? { mode: seed.mode } : {}),
        },
      };
    },
    [],
  );

  const tryApplyPendingFocus = useCallback(() => {
    const mod = pendingFocusReaderRef.current();
    if (mod != null) {
      pendingFocusRef.current = {
        ...(mod.userId ? { userId: mod.userId } : {}),
        ...(mod.listingId ? { listingId: mod.listingId } : {}),
        ...(mod.lat != null && mod.lng != null ? { lat: mod.lat, lng: mod.lng } : {}),
        ...(mod.displayName != null ? { displayName: mod.displayName } : {}),
        ...(mod.avatarUrl !== undefined ? { avatarUrl: mod.avatarUrl } : {}),
        ...(mod.verification != null ? { verification: mod.verification } : {}),
        ...(mod.online != null ? { online: mod.online } : {}),
        ...(mod.lastSeenAt != null ? { lastSeenAt: mod.lastSeenAt } : {}),
        ...(mod.title != null ? { title: mod.title } : {}),
        ...(mod.mode != null ? { mode: mod.mode } : {}),
        ...(mod.priceCents != null ? { priceCents: mod.priceCents } : {}),
        ...(mod.currency != null ? { currency: mod.currency } : {}),
        ...(mod.category != null ? { category: mod.category } : {}),
        ...(mod.thumbnailUrl !== undefined ? { thumbnailUrl: mod.thumbnailUrl } : {}),
      };
    }
    const pending = pendingFocusRef.current;
    if (!pending) return;

    const fromUser =
      pending.userId != null
        ? points.find(
            (p): p is EntityPoint & { kind: 'user' } =>
              p.kind === 'user' && p.id === pending.userId,
          )
        : undefined;
    const fromListing =
      pending.listingId != null
        ? points.find(
            (p): p is EntityPoint & { kind: 'listing' } =>
              p.kind === 'listing' && p.id === pending.listingId,
          )
        : undefined;

    const lat = pending.lat ?? fromUser?.lat ?? fromListing?.lat;
    const lng = pending.lng ?? fromUser?.lng ?? fromListing?.lng;
    if (lat == null || lng == null || !Number.isFinite(lat) || !Number.isFinite(lng)) {
      return;
    }

    const key = `${pending.userId ?? ''}|${pending.listingId ?? ''}|${lat}|${lng}|${mod?.token ?? 0}`;
    if (focusAppliedKeyRef.current === key) return;
    focusAppliedKeyRef.current = key;

    let point: EntityPoint | undefined;
    if (pending.listingId != null) {
      point = buildSeedListingPoint(pending.listingId, lat, lng, pending, fromListing);
      if (pending.mode === 'buy' || pending.mode === 'sell') {
        setListingModeFilter(pending.mode);
      }
    } else if (pending.userId != null) {
      point = buildSeedUserPoint(pending.userId, lat, lng, pending, fromUser);
    } else {
      point = fromUser ?? fromListing;
    }

    applyPeerFocus(lat, lng, point, mod?.token);
  }, [
    points,
    applyPeerFocus,
    buildSeedUserPoint,
    buildSeedListingPoint,
    setListingModeFilter,
  ]);

  useEffect(() => {
    if (focusMyPin) return;
    const hasUser = focusUserId != null && focusUserId !== '';
    const hasListing = focusListingId != null && focusListingId !== '';
    const hasCoords =
      focusLat != null &&
      focusLng != null &&
      Number.isFinite(focusLat) &&
      Number.isFinite(focusLng);
    if (!hasUser && !hasListing && !hasCoords) return;
    const mod = pendingFocusReaderRef.current();
    pendingFocusRef.current = {
      ...(mod?.userId || hasUser
        ? { userId: (hasUser ? focusUserId : mod?.userId) as string }
        : {}),
      ...(mod?.listingId || hasListing
        ? { listingId: (hasListing ? focusListingId : mod?.listingId) as string }
        : {}),
      ...(hasCoords
        ? { lat: focusLat as number, lng: focusLng as number }
        : mod?.lat != null && mod?.lng != null
          ? { lat: mod.lat, lng: mod.lng }
          : {}),
      ...(mod?.displayName != null ? { displayName: mod.displayName } : {}),
      ...(mod?.avatarUrl !== undefined ? { avatarUrl: mod.avatarUrl } : {}),
      ...(mod?.verification != null ? { verification: mod.verification } : {}),
      ...(mod?.online != null ? { online: mod.online } : {}),
      ...(mod?.lastSeenAt != null ? { lastSeenAt: mod.lastSeenAt } : {}),
      ...(mod?.title != null ? { title: mod.title } : {}),
      ...(mod?.mode != null ? { mode: mod.mode } : {}),
      ...(mod?.priceCents != null ? { priceCents: mod.priceCents } : {}),
      ...(mod?.currency != null ? { currency: mod.currency } : {}),
      ...(mod?.category != null ? { category: mod.category } : {}),
      ...(mod?.thumbnailUrl !== undefined ? { thumbnailUrl: mod.thumbnailUrl } : {}),
    };
    focusAppliedKeyRef.current = null;
  }, [focusUserId, focusListingId, focusLat, focusLng, focusMyPin]);

  useEffect(() => {
    if (!myCoords || region) return;
    if (
      focusMyPin ||
      focusUserId ||
      focusListingId ||
      pendingFocusRef.current ||
      pendingFocusReaderRef.current()
    ) {
      return;
    }
    mapRef.current?.animateToRegion(
      {
        latitude: myCoords.lat,
        longitude: myCoords.lng,
        latitudeDelta: 0.02,
        longitudeDelta: 0.02,
      },
      400,
    );
  }, [myCoords, region, focusMyPin, focusUserId, focusListingId, mapRef]);

  useFocusEffect(
    useCallback(() => {
      if (focusMyPin && myCoords) {
        mapRef.current?.animateToRegion(
          {
            latitude: myCoords.lat,
            longitude: myCoords.lng,
            latitudeDelta: 0.015,
            longitudeDelta: 0.015,
          },
          450,
        );
        clearFocusParams();
        return;
      }

      const mod = pendingFocusReaderRef.current();
      const hasUser =
        (focusUserId != null && focusUserId !== '') ||
        (mod?.userId != null && mod.userId !== '');
      const hasListing =
        (focusListingId != null && focusListingId !== '') ||
        (mod?.listingId != null && mod.listingId !== '');
      const lat = focusLat ?? mod?.lat;
      const lng = focusLng ?? mod?.lng;
      const hasCoords =
        lat != null && lng != null && Number.isFinite(lat) && Number.isFinite(lng);

      if (hasUser || hasListing || hasCoords) {
        const userId =
          focusUserId != null && focusUserId !== '' ? focusUserId : mod?.userId;
        const listingId =
          focusListingId != null && focusListingId !== ''
            ? focusListingId
            : mod?.listingId;
        pendingFocusRef.current = {
          ...(userId ? { userId } : {}),
          ...(listingId ? { listingId } : {}),
          ...(hasCoords ? { lat: lat as number, lng: lng as number } : {}),
          ...(mod?.displayName != null ? { displayName: mod.displayName } : {}),
          ...(mod?.avatarUrl !== undefined ? { avatarUrl: mod.avatarUrl } : {}),
          ...(mod?.verification != null ? { verification: mod.verification } : {}),
          ...(mod?.online != null ? { online: mod.online } : {}),
          ...(mod?.lastSeenAt != null ? { lastSeenAt: mod.lastSeenAt } : {}),
          ...(mod?.title != null ? { title: mod.title } : {}),
          ...(mod?.mode != null ? { mode: mod.mode } : {}),
          ...(mod?.priceCents != null ? { priceCents: mod.priceCents } : {}),
          ...(mod?.currency != null ? { currency: mod.currency } : {}),
          ...(mod?.category != null ? { category: mod.category } : {}),
          ...(mod?.thumbnailUrl !== undefined ? { thumbnailUrl: mod.thumbnailUrl } : {}),
        };
        focusAppliedKeyRef.current = null;
      }

      const task = InteractionManager.runAfterInteractions(() => {
        tryApplyPendingFocus();
      });
      return () => task.cancel();
    }, [
      focusMyPin,
      myCoords,
      focusUserId,
      focusListingId,
      focusLat,
      focusLng,
      clearFocusParams,
      tryApplyPendingFocus,
      mapRef,
    ]),
  );

  useEffect(() => {
    tryApplyPendingFocus();
  }, [points, focusUserId, focusListingId, focusLat, focusLng, tryApplyPendingFocus]);

  useEffect(() => {
    if (!region) return;
    tryApplyPendingFocus();
  }, [region, tryApplyPendingFocus]);
}
