import { useCallback, useSyncExternalStore } from 'react';
import type { LatLng } from '@g88/shared';

import { useNexaLaunchInteractionsReady } from '@/components/Brand/NexaLaunchSurfaceContext';

import {
  userLocationStore,
  type LocationPermissionStatus,
} from './userLocationStore';

// Real GPS comes from @react-native-community/geolocation (a native module).
// RN 0.83 no longer ships the legacy `navigator.geolocation` polyfill, so the
// device never produced a fix and no user was ever written to the discovery
// view — see useUserLocation history. Native ownership now lives in the shared,
// reference-counted userLocationStore so nested map UI does not stack watchers.

export type { LocationPermissionStatus } from './userLocationStore';

interface UseUserLocationResult {
  coords: LatLng | null;
  /** true after a denied permission state or native position error code 1. */
  permissionDenied: boolean;
  permissionStatus: LocationPermissionStatus;
  requestPermission: () => Promise<void>;
}

export function useUserLocation(): UseUserLocationResult {
  const launchInteractionsReady = useNexaLaunchInteractionsReady();
  const snapshot = useSyncExternalStore(
    userLocationStore.subscribe,
    userLocationStore.getSnapshot,
    userLocationStore.getSnapshot,
  );

  const requestPermission = useCallback(async () => {
    // Native permission sheets interrupt the launch dissolve/handoff. MapScreen's
    // mount effect depends on this callback, so it automatically retries when the
    // one-shot launch gate flips to ready. Calls outside AppShell default to ready.
    if (!launchInteractionsReady) return;
    await userLocationStore.requestPermission();
  }, [launchInteractionsReady]);

  return {
    coords: snapshot.coords,
    permissionDenied: snapshot.permissionStatus === 'denied',
    permissionStatus: snapshot.permissionStatus,
    requestPermission,
  };
}
