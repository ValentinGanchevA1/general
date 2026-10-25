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
  /** Location is only active for an authenticated app session. */
  enabled: boolean;
}

/**
 * Owns the single native GPS watcher for the authenticated application. Every
 * useUserLocation() consumer reads this shared state instead of creating its own
 * getCurrentPosition/watchPosition pair.
 */
export function UserLocationProvider({
  children,
  enabled,
}: UserLocationProviderProps): React.JSX.Element {
  const [coords, setCoords] = useState<LatLng | null>(null);
  const [permissionStatus, setPermissionStatus] =
    useState<LocationPermissionStatus>('unknown');
  const watchId = useRef<number | null>(null);
  const permissionRequestRef = useRef<Promise<void> | null>(null);
  const enabledRef = useRef(enabled);
  const launchInteractionsReady = useNexaLaunchInteractionsReady();
  enabledRef.current = enabled;

  const stopTracking = useCallback((): void => {
    if (watchId.current === null) return;
    Geolocation.clearWatch(watchId.current);
    watchId.current = null;
  }, []);

  const startTracking = useCallback((): void => {
    if (!enabledRef.current || watchId.current !== null) return;

    const onOk = (pos: { coords: { latitude: number; longitude: number } }): void => {
      if (!enabledRef.current) return;
      setPermissionStatus('granted');
      setCoords({ lat: pos.coords.latitude, lng: pos.coords.longitude });
    };

    const onErr = (err: { code?: number }): void => {
      if (!enabledRef.current) return;
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

  const requestPermission = useCallback((): Promise<void> => {
    // Native permission sheets interrupt the launch dissolve/handoff. Calls from
    // already-mounted screens are retried automatically because this callback
    // identity changes only when auth or the one-shot interaction gate changes.
    if (!enabled || !launchInteractionsReady) return Promise.resolve();

    const inFlight = permissionRequestRef.current;
    if (inFlight !== null) return inFlight;

    const request = (async (): Promise<void> => {
      if (Platform.OS === 'android') {
        const granted = await PermissionsAndroid.request(
          PermissionsAndroid.PERMISSIONS.ACCESS_FINE_LOCATION,
          NEXA_LOCATION_PERMISSION_COPY,
        );
        if (!enabledRef.current) return;
        if (granted !== PermissionsAndroid.RESULTS.GRANTED) {
          setPermissionStatus('denied');
          return;
        }
        setPermissionStatus('granted');
      } else {
        Geolocation.requestAuthorization();
      }

      startTracking();
    })();

    permissionRequestRef.current = request;
    void request.finally(() => {
      if (permissionRequestRef.current === request) {
        permissionRequestRef.current = null;
      }
    });
    return request;
  }, [enabled, launchInteractionsReady, startTracking]);

  // Warm path: already-granted Android permission can start GPS beneath the
  // launch overlay without presenting native UI. A negative quiet check remains
  // `unknown` because Android cannot distinguish never-asked from denied here.
  useEffect(() => {
    if (!enabled) return;

    let cancelled = false;
    void (async () => {
      if (Platform.OS === 'android') {
        const fine = await PermissionsAndroid.check(
          PermissionsAndroid.PERMISSIONS.ACCESS_FINE_LOCATION,
        );
        if (cancelled || !enabledRef.current) return;
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
  }, [enabled, startTracking]);

  useEffect(() => {
    if (enabled) return;
    stopTracking();
    setCoords(null);
    setPermissionStatus('unknown');
  }, [enabled, stopTracking]);

  useEffect(() => stopTracking, [stopTracking]);

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
