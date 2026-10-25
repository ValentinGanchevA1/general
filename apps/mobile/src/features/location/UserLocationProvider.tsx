import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  AppState,
  PermissionsAndroid,
  Platform,
  type AppStateStatus,
} from 'react-native';
import Geolocation from '@react-native-community/geolocation';
import type { LatLng } from '@g88/shared';

import { useNexaLaunchInteractionsReady } from '@/components/Brand/NexaLaunchSurfaceContext';

import { NEXA_LOCATION_PERMISSION_COPY } from './locationPermissionCopy';
import {
  shouldRequestLocationPermission,
  statusFromAndroidForegroundCheck,
  statusFromAndroidPermissionCheck,
  type LocationPermissionStatus,
} from './locationPermissionState';
import {
  UserLocationContext,
  type GetCurrentLocationOptions,
  type UserLocationContextValue,
} from './UserLocationContext';

interface UserLocationProviderProps {
  children: React.ReactNode;
  /** Location is only active for an authenticated app session. */
  enabled: boolean;
}

type LocationWaiter = (location: LatLng | null) => void;

/**
 * Owns all native geolocation access for the authenticated application. Every
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
  const coordsRef = useRef<LatLng | null>(null);
  const permissionStatusRef = useRef<LocationPermissionStatus>('unknown');
  const watchId = useRef<number | null>(null);
  const permissionRequestRef = useRef<Promise<void> | null>(null);
  const locationWaitersRef = useRef<Set<LocationWaiter>>(new Set());
  const enabledRef = useRef(enabled);
  const appStateRef = useRef<AppStateStatus>(AppState.currentState);
  const launchInteractionsReady = useNexaLaunchInteractionsReady();

  const updatePermissionStatus = useCallback(
    (nextStatus: LocationPermissionStatus): void => {
      permissionStatusRef.current = nextStatus;
      setPermissionStatus(nextStatus);
    },
    [],
  );

  const resolveLocationWaiters = useCallback(
    (location: LatLng | null): void => {
      const waiters = [...locationWaitersRef.current];
      locationWaitersRef.current.clear();
      for (const resolve of waiters) resolve(location);
    },
    [],
  );

  const updateCoords = useCallback(
    (nextCoords: LatLng): void => {
      coordsRef.current = nextCoords;
      setCoords(nextCoords);
      resolveLocationWaiters(nextCoords);
    },
    [resolveLocationWaiters],
  );

  const waitForCurrentLocation = useCallback((): Promise<LatLng | null> => {
    const current = coordsRef.current;
    if (current !== null) return Promise.resolve(current);

    return new Promise((resolve) => {
      let timer: ReturnType<typeof setTimeout> | null = null;
      const finish: LocationWaiter = (location) => {
        if (timer !== null) clearTimeout(timer);
        locationWaitersRef.current.delete(finish);
        resolve(location);
      };
      timer = setTimeout(() => finish(null), 15_000);
      locationWaitersRef.current.add(finish);
    });
  }, []);

  const stopTracking = useCallback((): void => {
    if (watchId.current !== null) {
      Geolocation.clearWatch(watchId.current);
      watchId.current = null;
    }
    resolveLocationWaiters(null);
  }, [resolveLocationWaiters]);

  const startTracking = useCallback((): void => {
    if (
      !enabledRef.current ||
      appStateRef.current !== 'active' ||
      watchId.current !== null
    ) {
      return;
    }

    const onOk = (pos: { coords: { latitude: number; longitude: number } }): void => {
      if (!enabledRef.current || appStateRef.current !== 'active') return;
      updatePermissionStatus('granted');
      updateCoords({ lat: pos.coords.latitude, lng: pos.coords.longitude });
    };

    const onErr = (err: { code?: number }): void => {
      if (!enabledRef.current) return;
      if (err?.code === 1) {
        stopTracking();
        updatePermissionStatus('denied');
        return;
      }
      resolveLocationWaiters(null);
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
  }, [
    resolveLocationWaiters,
    stopTracking,
    updateCoords,
    updatePermissionStatus,
  ]);

  const performPermissionRequest = useCallback(
    (explicitRetry: boolean): Promise<void> => {
      // Native permission sheets interrupt the launch dissolve/handoff. Automatic
      // callers may request once while status is unknown, but only direct user
      // recovery may reopen native UI after an explicit denial.
      if (
        !enabled ||
        !launchInteractionsReady ||
        appStateRef.current !== 'active'
      ) {
        return Promise.resolve();
      }
      if (
        !shouldRequestLocationPermission(
          permissionStatusRef.current,
          explicitRetry,
        )
      ) {
        return Promise.resolve();
      }

      const inFlight = permissionRequestRef.current;
      if (inFlight !== null) return inFlight;

      const request = (async (): Promise<void> => {
        try {
          if (Platform.OS === 'android') {
            const granted = await PermissionsAndroid.request(
              PermissionsAndroid.PERMISSIONS.ACCESS_FINE_LOCATION,
              NEXA_LOCATION_PERMISSION_COPY,
            );
            if (!enabledRef.current) return;
            if (granted !== PermissionsAndroid.RESULTS.GRANTED) {
              updatePermissionStatus('denied');
              return;
            }
            updatePermissionStatus('granted');
          } else {
            Geolocation.requestAuthorization();
          }

          startTracking();
        } catch {
          // A native bridge failure is not an explicit user denial. Keep the
          // permission state retryable and avoid rejecting fire-and-forget callers.
          if (enabledRef.current) updatePermissionStatus('unknown');
        }
      })();

      permissionRequestRef.current = request;
      const clearInFlight = (): void => {
        if (permissionRequestRef.current === request) {
          permissionRequestRef.current = null;
        }
      };
      void request.then(clearInFlight, clearInFlight);
      return request;
    },
    [enabled, launchInteractionsReady, startTracking, updatePermissionStatus],
  );

  const requestPermission = useCallback(
    (): Promise<void> => performPermissionRequest(false),
    [performPermissionRequest],
  );

  const retryPermission = useCallback(
    (): Promise<void> => performPermissionRequest(true),
    [performPermissionRequest],
  );

  const getCurrentLocation = useCallback(
    async (
      options: GetCurrentLocationOptions = {},
    ): Promise<LatLng | null> => {
      if (!enabledRef.current || appStateRef.current !== 'active') return null;

      const current = coordsRef.current;
      if (current !== null) return current;

      if (!launchInteractionsReady) return null;

      if (permissionStatusRef.current !== 'granted') {
        if (options.requestPermission !== true) return null;
        await performPermissionRequest(true);
      }

      if (!enabledRef.current || appStateRef.current !== 'active') return null;

      const afterPermission = coordsRef.current;
      if (afterPermission !== null) return afterPermission;

      // Android's explicit request resolves with an authoritative result. Never
      // perform a native location read while permission is still unknown/denied.
      if (
        Platform.OS === 'android' &&
        permissionStatusRef.current !== 'granted'
      ) {
        return null;
      }

      // iOS authorization/fix delivery is callback-driven. startTracking owns the
      // native read and watcher; this method only waits for that shared first fix.
      startTracking();
      return waitForCurrentLocation();
    },
    [
      launchInteractionsReady,
      performPermissionRequest,
      startTracking,
      waitForCurrentLocation,
    ],
  );

  // Keep async native callbacks aware of the current auth-session state without
  // reading or writing refs during render. Session-bound remounting resets the
  // exposed coordinates and permission state when the authenticated user changes.
  useEffect(() => {
    enabledRef.current = enabled;
    if (!enabled) stopTracking();
  }, [enabled, stopTracking]);

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
        if (
          cancelled ||
          !enabledRef.current ||
          appStateRef.current !== 'active'
        ) {
          return;
        }
        const quietStatus = statusFromAndroidPermissionCheck(fine);
        updatePermissionStatus(quietStatus);
        if (quietStatus === 'granted') startTracking();
        return;
      }

      // iOS: attempt a quiet fix; authorization prompt is still explicit.
      startTracking();
    })();

    return () => {
      cancelled = true;
    };
  }, [enabled, startTracking, updatePermissionStatus]);

  useEffect(() => {
    const onAppStateChange = (nextState: AppStateStatus): void => {
      appStateRef.current = nextState;
      if (!enabledRef.current) return;

      if (nextState !== 'active') {
        stopTracking();
        return;
      }

      if (Platform.OS !== 'android') {
        startTracking();
        return;
      }

      void (async () => {
        try {
          const fine = await PermissionsAndroid.check(
            PermissionsAndroid.PERMISSIONS.ACCESS_FINE_LOCATION,
          );
          if (
            !enabledRef.current ||
            appStateRef.current !== 'active'
          ) {
            return;
          }
          const nextStatus = statusFromAndroidForegroundCheck(
            fine,
            permissionStatusRef.current,
          );
          updatePermissionStatus(nextStatus);
          if (nextStatus === 'granted') startTracking();
          else stopTracking();
        } catch {
          // A quiet refresh failure must not downgrade permission state or prompt.
        }
      })();
    };

    const subscription = AppState.addEventListener('change', onAppStateChange);
    return () => subscription.remove();
  }, [startTracking, stopTracking, updatePermissionStatus]);

  useEffect(() => stopTracking, [stopTracking]);

  const value = useMemo<UserLocationContextValue>(
    () => ({
      coords,
      permissionDenied: permissionStatus === 'denied',
      permissionStatus,
      requestPermission,
      retryPermission,
      getCurrentLocation,
    }),
    [
      coords,
      permissionStatus,
      requestPermission,
      retryPermission,
      getCurrentLocation,
    ],
  );

  return (
    <UserLocationContext.Provider value={value}>
      {children}
    </UserLocationContext.Provider>
  );
}
