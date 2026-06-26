import { useCallback, useEffect, useRef, useState } from 'react';
import { Alert, PermissionsAndroid, Platform } from 'react-native';
import Geolocation from '@react-native-community/geolocation';
import type { LatLng } from '@g88/shared';

// Real GPS comes from @react-native-community/geolocation (a native module).
// RN 0.83 no longer ships the legacy `navigator.geolocation` polyfill, so the
// device never produced a fix and no user was ever written to the discovery
// view — see useUserLocation history. This module is autolinked; it needs an
// Android rebuild, not just a Metro reload.

interface UseUserLocationResult {
  coords: LatLng | null;
  requestPermission: () => Promise<void>;
}

export function useUserLocation(): UseUserLocationResult {
  const [coords, setCoords] = useState<LatLng | null>(null);
  const watchId = useRef<number | null>(null);

  const startTracking = useCallback(() => {
    // Don't stack watchers if requestPermission runs more than once.
    if (watchId.current !== null) return;

    // Immediate first fix so the map can centre and presence can fire right away.
    Geolocation.getCurrentPosition(
      (pos) => setCoords({ lat: pos.coords.latitude, lng: pos.coords.longitude }),
      (err) => Alert.alert('Location error', err.message),
      { enableHighAccuracy: true, timeout: 15_000, maximumAge: 10_000 },
    );

    // Continuous updates; the library throttles by movement (distanceFilter).
    watchId.current = Geolocation.watchPosition(
      (pos) => setCoords({ lat: pos.coords.latitude, lng: pos.coords.longitude }),
      () => undefined,
      { enableHighAccuracy: true, distanceFilter: 25 },
    );
  }, []); // setCoords is a stable state setter; watchId is a ref

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
      if (granted !== PermissionsAndroid.RESULTS.GRANTED) return;
    } else {
      Geolocation.requestAuthorization();
    }
    startTracking();
  }, [startTracking]);

  useEffect(() => {
    return () => {
      if (watchId.current !== null) {
        Geolocation.clearWatch(watchId.current);
        watchId.current = null;
      }
    };
  }, []);

  return { coords, requestPermission };
}
