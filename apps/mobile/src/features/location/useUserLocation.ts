import { useCallback, useEffect, useRef, useState } from 'react';
import { PermissionsAndroid, Platform } from 'react-native';
import Geolocation from '@react-native-community/geolocation';
import type { LatLng } from '@g88/shared';

// Real GPS comes from @react-native-community/geolocation (a native module).
// RN 0.83 no longer ships the legacy `navigator.geolocation` polyfill, so the
// device never produced a fix and no user was ever written to the discovery
// view — see useUserLocation history. This module is autolinked; it needs an
// Android rebuild, not just a Metro reload.

export type LocationPermissionStatus = 'unknown' | 'granted' | 'denied';

interface UseUserLocationResult {
  coords: LatLng | null;
  /** true after an explicit deny (or iOS position error code 1). */
  permissionDenied: boolean;
  permissionStatus: LocationPermissionStatus;
  requestPermission: () => Promise<void>;
}

export function useUserLocation(): UseUserLocationResult {
  const [coords, setCoords] = useState<LatLng | null>(null);
  const [permissionStatus, setPermissionStatus] =
    useState<LocationPermissionStatus>('unknown');
  const watchId = useRef<number | null>(null);

  const startTracking = useCallback(() => {
    // Don't stack watchers if requestPermission runs more than once.
    if (watchId.current !== null) return;

    const onOk = (pos: { coords: { latitude: number; longitude: number } }): void => {
      setPermissionStatus('granted');
      setCoords({ lat: pos.coords.latitude, lng: pos.coords.longitude });
    };

    const onErr = (err: { code?: number }): void => {
      // 1 = PERMISSION_DENIED in the Geolocation error codes.
      if (err?.code === 1) {
        setPermissionStatus('denied');
      }
    };

    // Immediate first fix so the map can centre and presence can fire right away.
    Geolocation.getCurrentPosition(
      onOk,
      onErr,
      { enableHighAccuracy: true, timeout: 15_000, maximumAge: 10_000 },
    );

    // Continuous updates; the library throttles by movement (distanceFilter).
    watchId.current = Geolocation.watchPosition(
      onOk,
      onErr,
      { enableHighAccuracy: true, distanceFilter: 25 },
    );
  }, []);

  const requestPermission = useCallback(async () => {
    if (Platform.OS === 'android') {
      const granted = await PermissionsAndroid.request(
        PermissionsAndroid.PERMISSIONS.ACCESS_FINE_LOCATION,
        {
          title: 'Location Permission',
          message: 'G88 needs your location to show nearby people and places.',
          buttonPositive: 'Allow',
        },
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
  }, [startTracking]);

  // If the user already granted location (common on Pulse after visiting Map),
  // start GPS without waiting for an explicit requestPermission() call.
  useEffect(() => {
    let cancelled = false;
    void (async () => {
      if (Platform.OS === 'android') {
        const fine = await PermissionsAndroid.check(
          PermissionsAndroid.PERMISSIONS.ACCESS_FINE_LOCATION,
        );
        if (cancelled) return;
        if (!fine) {
          setPermissionStatus('denied');
          return;
        }
        setPermissionStatus('granted');
        startTracking();
        return;
      }
      // iOS: attempt a quiet fix; authorization prompt is still via requestPermission.
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

  return {
    coords,
    permissionDenied: permissionStatus === 'denied',
    permissionStatus,
    requestPermission,
  };
}
