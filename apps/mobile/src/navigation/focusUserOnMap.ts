// apps/mobile/src/navigation/focusUserOnMap.ts
//
// Shared "View on map" for peer pins: inbox waves, profile, push taps.
// Uses pendingMapFocus module + Main/Map focus params (nested-tab safe).

import type { PublicUserProfile, VerificationLevel } from '@g88/shared';

import { getJson } from '@/api/client';
import { setPendingMapFocus } from '@/navigation/pendingMapFocus';
import { navigationRef } from '@/navigation/navigationRef';

export type FocusUserOnMapInput = {
  userId: string;
  displayName?: string;
  avatarUrl?: string | null;
  verification?: VerificationLevel | null;
  /** When known (profile already loaded), skip the fetch. */
  lat?: number;
  lng?: number;
};

export type FocusUserOnMapResult = 'ok' | 'no_pin' | 'error';

type NavLike = {
  navigate: (name: string, params?: object) => void;
};

async function resolveCoords(
  input: FocusUserOnMapInput,
): Promise<{
  lat: number;
  lng: number;
  displayName?: string;
  avatarUrl?: string | null;
  verification?: VerificationLevel;
  online?: boolean;
} | null> {
  const hasCoords =
    input.lat != null &&
    input.lng != null &&
    Number.isFinite(input.lat) &&
    Number.isFinite(input.lng);

  if (hasCoords) {
    return {
      lat: input.lat as number,
      lng: input.lng as number,
      ...(input.displayName != null ? { displayName: input.displayName } : {}),
      ...(input.avatarUrl !== undefined ? { avatarUrl: input.avatarUrl } : {}),
      ...(input.verification != null ? { verification: input.verification } : {}),
    };
  }

  try {
    const profile = await getJson<PublicUserProfile>(`/users/${input.userId}`);
    const lat = profile.mapLat;
    const lng = profile.mapLng;
    if (
      lat == null ||
      lng == null ||
      !Number.isFinite(lat) ||
      !Number.isFinite(lng)
    ) {
      return null;
    }
    return {
      lat,
      lng,
      displayName: profile.displayName,
      avatarUrl: profile.avatarUrl,
      verification: profile.verification,
      online: profile.online === true,
    };
  } catch {
    return null;
  }
}

function navigateToMapFocus(
  navigation: NavLike,
  userId: string,
  lat: number,
  lng: number,
): void {
  navigation.navigate('Main', {
    screen: 'Map',
    params: {
      focusUserId: userId,
      focusLat: lat,
      focusLng: lng,
    },
    merge: true,
  });
}

/**
 * Animate Map to the peer pin and select their entity sheet when possible.
 * Returns `no_pin` when the peer has no public map coordinates (still navigates
 * with focusUserId so an in-viewport pin can be selected).
 */
export async function focusUserOnMap(
  navigation: NavLike,
  input: FocusUserOnMapInput,
): Promise<FocusUserOnMapResult> {
  const resolved = await resolveCoords(input);
  if (!resolved) {
    setPendingMapFocus({
      userId: input.userId,
      ...(input.displayName != null ? { displayName: input.displayName } : {}),
      ...(input.avatarUrl !== undefined ? { avatarUrl: input.avatarUrl } : {}),
      ...(input.verification != null ? { verification: input.verification } : {}),
    });
    navigation.navigate('Main', {
      screen: 'Map',
      params: { focusUserId: input.userId },
      merge: true,
    });
    return 'no_pin';
  }

  setPendingMapFocus({
    userId: input.userId,
    lat: resolved.lat,
    lng: resolved.lng,
    ...(resolved.displayName != null ? { displayName: resolved.displayName } : {}),
    ...(resolved.avatarUrl !== undefined ? { avatarUrl: resolved.avatarUrl } : {}),
    ...(resolved.verification != null ? { verification: resolved.verification } : {}),
    ...(resolved.online != null ? { online: resolved.online } : {}),
  });
  navigateToMapFocus(navigation, input.userId, resolved.lat, resolved.lng);
  return 'ok';
}

/** Push / ref path when no screen navigation prop is available. */
export async function focusUserOnMapViaRef(
  input: FocusUserOnMapInput,
): Promise<FocusUserOnMapResult> {
  if (!navigationRef.isReady()) return 'error';
  return focusUserOnMap(
    {
      navigate: ((name: string, params?: object) => {
        (navigationRef.navigate as (n: string, p?: object) => void)(name, params);
      }) as NavLike['navigate'],
    },
    input,
  );
}
