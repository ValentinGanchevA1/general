import { useCallback, useEffect, useState } from 'react';
import { Alert, Platform } from 'react-native';
import { PermissionsAndroid } from 'react-native';
import type { LatLng } from '@g88/shared';

// navigator.geolocation is still available at runtime in React Native but is
// no longer typed in @types/react-native — declare the subset we use.
declare const navigator: {
  geolocation: {
    getCurrentPosition(
      success: (pos: { coords: { latitude: number; longitude: number } }) => void,
      error?: (err: { message: string }) => void,
      options?: { enableHighAccuracy?: boolean; timeout?: number },
    ): void;
  } | undefined;
};

interface UseUserLocationResult {
  coords: LatLng | null;
  requestPermission: () => Promise<void>;
}

export function useUserLocation(): UseUserLocationResult {
  const [coords, setCoords] = useState<LatLng | null>(null);
  const [watchId, setWatchId] = useState<ReturnType<typeof setInterval> | null>(null);

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
    }
    startTracking();
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  function startTracking() {
    const geo = typeof navigator !== 'undefined' ? navigator.geolocation : undefined;
    if (!geo) return;
    geo.getCurrentPosition(
      (pos) => setCoords({ lat: pos.coords.latitude, lng: pos.coords.longitude }),
      (err) => Alert.alert('Location error', err.message),
      { enableHighAccuracy: true, timeout: 15_000 },
    );

    const id = setInterval(() => {
      geo.getCurrentPosition(
        (pos) => setCoords({ lat: pos.coords.latitude, lng: pos.coords.longitude }),
        () => undefined,
        { enableHighAccuracy: true, timeout: 10_000 },
      );
    }, 30_000);
    setWatchId(id);
  }

  useEffect(() => {
    return () => {
      if (watchId !== null) clearInterval(watchId);
    };
  }, [watchId]);

  return { coords, requestPermission };
}
