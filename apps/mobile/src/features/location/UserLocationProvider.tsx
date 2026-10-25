import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { PermissionsAndroid, Platform } from 'react-native';
import Geolocation from '@react-native-community/geolocation';
import type { LatLng } from '@g88/shared';

import { useNexaLaunchInteractionsReady } from '@/components/Brand/NexaLaunchSurfaceContext';

import { NEXA_LOCATION_PERMISSION_COPY } from './locationPermissionCopy';
import {
  statusFromAndroidPermissionCheck,
  type LocationPermissionStatus,
} from './locationPermissionState';
import {
  UserLocationContext,
  type UserLocationContextValue,
} from './UserLocationContext';

interface UserLocationProviderProps {
  children: React.ReactNode;
}

/**
 * Owns the single native GPS watcher for the mounted application. Every
 * useUserLocation() consumer reads this shared state instead of creating its own
 * getCurrentPosition/watchPosition pair.
 */
export function UserLocationProvider({
  children,
}: UserLocationProviderProps): React.JSX.Element {
  const [coords, setCoords] = useState<LatLng | null>(null);
  const [permissionStatus, setPermissionStatus] =
    useState<LocationPermissionStatus>('unknown');
  const watchId = useRef<number | null>(null);
  const launchInteractionsReady = useNexaLaunchInteractionsReady();

  const startTracking = useCallback((): void => {
    if (watchId.current !== null) return;

    const onOk = (pos: { coords: { latitude: number; longitude: number } }): void => {
      setPermissionStatus('granted');
      setCoords({ lat: pos.coords.latitude, lng: pos.coords.longitude });
    };

    const onErr = (err: { code?: number }): void => {
      if (err?.code === 1) {
        setPermissionStatus('denied');
      }
    };

    Geolocation.getCurrentPosition(
      onOk,
      onErr,
      { enableHighAccuracy: true, timeout: 15_000, maximumAge: 10_000 },
    );

    watchId.current = Geolocation.watchPosition(
      onOk,
      onErr,
      { enableHighAccuracy: true, distanceFilter: 25 },
    );
  }, []);

  const requestPermission = useCallback(async (): Promise<void> => {
    // Native permission sheets interrupt the launch dissolve/handoff. Calls from
    // already-mounted screens are retried automatically because this callback
    // identity changes only when the one-shot interaction gate becomes ready.
    if (!launchInteractionsReady) return;

    if (Platform.OS === 'android') {
      const granted = await PermissionsAndroid.request(
        PermissionsAndroid.PERMISSIONS.ACCESS_FINE_LOCATION,
        NEXA_LOCATION_PERMISSION_COPY,
      );
      if (granted !== PermissionsAndroid.RESULTS.GRANTED) {
        setPermissionStatus('denied');
        return;
      }
      setPermissionStatus('granted');
    } else {
      Geolocation.requestAuthorization();
    }

    startTracking();
  }, [launchInteractionsReady, startTracking]);

  // Warm path: already-granted Android permission can start GPS beneath the
  // launch overlay without presenting native UI. A negative quiet check remains
  // `unknown` because Android cannot distinguish never-asked from denied here.
  useEffect(() => {
    let cancelled = false;
    void (async () => {
      if (Platform.OS === 'android') {
        const fine = await PermissionsAndroid.check(
          PermissionsAndroid.PERMISSIONS.ACCESS_FINE_LOCATION,
        );
        if (cancelled) return;
        const quietStatus = statusFromAndroidPermissionCheck(fine);
        setPermissionStatus(quietStatus);
        if (quietStatus === 'granted') startTracking();
        return;
      }

      // iOS: attempt a quiet fix; authorization prompt is still explicit.
      startTracking();
    })();

    return () => {
      cancelled = true;
    };
  }, [startTracking]);

  useEffect(() => {
    return () => {
      if (watchId.current !== null) {
        Geolocation.clearWatch(watchId.current);
        watchId.current = null;
      }
    };
  }, []);

  const value = useMemo<UserLocationContextValue>(
    () => ({
      coords,
      permissionDenied: permissionStatus === 'denied',
      permissionStatus,
      requestPermission,
    }),
    [coords, permissionStatus, requestPermission],
  );

  return (
    <UserLocationContext.Provider value={value}>
      {children}
    </UserLocationContext.Provider>
  );
}
