import { PermissionsAndroid, Platform } from 'react-native';
import Geolocation from '@react-native-community/geolocation';
import type { LatLng } from '@g88/shared';

import { NEXA_LOCATION_PERMISSION_COPY } from './locationPermissionCopy';

export type LocationPermissionStatus = 'unknown' | 'granted' | 'denied';

export interface UserLocationSnapshot {
  coords: LatLng | null;
  permissionStatus: LocationPermissionStatus;
}

interface NativePosition {
  coords: {
    latitude: number;
    longitude: number;
  };
}

interface NativePositionError {
  code?: number;
}

type PositionSuccess = (position: NativePosition) => void;
type PositionError = (error: NativePositionError) => void;

export interface UserLocationNativeAdapter {
  hasPermission: () => Promise<boolean>;
  requestPermission: () => Promise<boolean>;
  getCurrentPosition: (onSuccess: PositionSuccess, onError: PositionError) => void;
  watchPosition: (onSuccess: PositionSuccess, onError: PositionError) => number;
  clearWatch: (watchId: number) => void;
}

export interface UserLocationStore {
  subscribe: (listener: () => void) => () => void;
  getSnapshot: () => UserLocationSnapshot;
  requestPermission: () => Promise<void>;
}

const INITIAL_SNAPSHOT: UserLocationSnapshot = {
  coords: null,
  permissionStatus: 'unknown',
};

const nativeAdapter: UserLocationNativeAdapter = {
  hasPermission: async () => {
    if (Platform.OS !== 'android') return true;
    return PermissionsAndroid.check(
      PermissionsAndroid.PERMISSIONS.ACCESS_FINE_LOCATION,
    );
  },
  requestPermission: async () => {
    if (Platform.OS !== 'android') {
      Geolocation.requestAuthorization();
      return true;
    }

    const result = await PermissionsAndroid.request(
      PermissionsAndroid.PERMISSIONS.ACCESS_FINE_LOCATION,
      NEXA_LOCATION_PERMISSION_COPY,
    );
    return result === PermissionsAndroid.RESULTS.GRANTED;
  },
  getCurrentPosition: (onSuccess, onError) => {
    Geolocation.getCurrentPosition(onSuccess, onError, {
      enableHighAccuracy: true,
      timeout: 15_000,
      maximumAge: 10_000,
    });
  },
  watchPosition: (onSuccess, onError) =>
    Geolocation.watchPosition(onSuccess, onError, {
      enableHighAccuracy: true,
      distanceFilter: 25,
    }),
  clearWatch: (watchId) => Geolocation.clearWatch(watchId),
};

/**
 * Shared, reference-counted location store.
 *
 * Multiple map/pulse components can subscribe at once, but the process owns at
 * most one native watchPosition subscription. The watch is released as soon as
 * the last consumer unmounts, so sharing does not turn location into a
 * process-lifetime background service.
 */
export function createUserLocationStore(
  adapter: UserLocationNativeAdapter = nativeAdapter,
): UserLocationStore {
  let snapshot: UserLocationSnapshot = INITIAL_SNAPSHOT;
  let watchId: number | null = null;
  let subscriberCount = 0;
  let warmPermissionCheck: Promise<void> | null = null;
  let permissionRequest: Promise<void> | null = null;
  const listeners = new Set<() => void>();

  const publish = (next: UserLocationSnapshot): void => {
    const sameCoords =
      snapshot.coords === next.coords ||
      (snapshot.coords != null &&
        next.coords != null &&
        snapshot.coords.lat === next.coords.lat &&
        snapshot.coords.lng === next.coords.lng);
    if (
      sameCoords &&
      snapshot.permissionStatus === next.permissionStatus
    ) {
      return;
    }

    snapshot = next;
    for (const listener of listeners) listener();
  };

  const setPermissionStatus = (permissionStatus: LocationPermissionStatus): void => {
    publish({ ...snapshot, permissionStatus });
  };

  const stopTracking = (): void => {
    if (watchId == null) return;
    adapter.clearWatch(watchId);
    watchId = null;
  };

  const onPosition = (position: NativePosition): void => {
    if (subscriberCount <= 0) return;
    publish({
      coords: {
        lat: position.coords.latitude,
        lng: position.coords.longitude,
      },
      permissionStatus: 'granted',
    });
  };

  const onPositionError = (error: NativePositionError): void => {
    if (subscriberCount <= 0) return;
    // 1 = PERMISSION_DENIED in the native Geolocation error codes.
    if (error.code === 1) setPermissionStatus('denied');
  };

  const startTracking = (): void => {
    if (subscriberCount <= 0 || watchId != null) return;

    adapter.getCurrentPosition(onPosition, onPositionError);
    watchId = adapter.watchPosition(onPosition, onPositionError);
  };

  const warmIfAuthorized = (): void => {
    if (warmPermissionCheck != null) return;

    warmPermissionCheck = (async () => {
      try {
        const granted = await adapter.hasPermission();
        if (subscriberCount <= 0) return;
        if (!granted) {
          setPermissionStatus('denied');
          return;
        }
        setPermissionStatus('granted');
        startTracking();
      } finally {
        warmPermissionCheck = null;
      }
    })();

    void warmPermissionCheck.catch(() => {
      // Permission probing is best-effort. Explicit requestPermission remains
      // available to the user if the native check itself fails.
    });
  };

  const subscribe = (listener: () => void): (() => void) => {
    listeners.add(listener);
    subscriberCount += 1;
    if (subscriberCount === 1) warmIfAuthorized();

    let active = true;
    return () => {
      if (!active) return;
      active = false;
      listeners.delete(listener);
      subscriberCount = Math.max(0, subscriberCount - 1);
      if (subscriberCount === 0) stopTracking();
    };
  };

  const requestPermissionShared = async (): Promise<void> => {
    if (snapshot.permissionStatus === 'granted') {
      startTracking();
      return;
    }
    if (permissionRequest != null) return permissionRequest;

    permissionRequest = (async () => {
      const granted = await adapter.requestPermission();
      if (!granted) {
        setPermissionStatus('denied');
        return;
      }
      setPermissionStatus('granted');
      startTracking();
    })().finally(() => {
      permissionRequest = null;
    });

    return permissionRequest;
  };

  return {
    subscribe,
    getSnapshot: () => snapshot,
    requestPermission: requestPermissionShared,
  };
}

export const userLocationStore = createUserLocationStore();
