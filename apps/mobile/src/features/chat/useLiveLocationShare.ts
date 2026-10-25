import { useCallback, useEffect, useRef, useState } from 'react';
import { Linking, Platform } from 'react-native';

import { appAlert } from '@/ui/appAlert';

import type {
  ChatLocation,
  LocationShareDuration,
  LocationShareSession,
} from '@g88/shared';

import { getJson } from '@/api/client';
import { useAppDispatch, useAppSelector } from '@/hooks/redux';
import { messageReceived } from '@/features/chat/chatSlice';
import { useUserLocation } from '@/features/location/useUserLocation';
import {
  locationShareStart,
  locationShareStop,
  locationShareUpdate,
  useSocket,
} from '@/realtime/useSocket';

const MIN_EMIT_MS = 5_000;
const FALLBACK_INTERVAL_MS = 15_000;

interface UseLiveLocationShareResult {
  session: LocationShareSession | null;
  starting: boolean;
  stopping: boolean;
  isSharer: boolean;
  start: (duration: LocationShareDuration) => Promise<void>;
  stop: () => Promise<void>;
  openInMaps: () => void;
}

export function useLiveLocationShare(conversationId: string): UseLiveLocationShareResult {
  const dispatch = useAppDispatch();
  const myUserId = useAppSelector((s) => s.auth.user?.id ?? '');
  const { on, connected } = useSocket();
  const {
    coords: sharedCoords,
    getCurrentLocation,
  } = useUserLocation();
  const sharedLat = sharedCoords?.lat;
  const sharedLng = sharedCoords?.lng;

  const [session, setSession] = useState<LocationShareSession | null>(null);
  const [starting, setStarting] = useState(false);
  const [stopping, setStopping] = useState(false);

  const sessionRef = useRef<LocationShareSession | null>(null);
  const lastEmitRef = useRef(0);
  const latestCoordsRef = useRef<ChatLocation | null>(null);

  useEffect(() => {
    sessionRef.current = session;
  }, [session]);

  const isSharer = !!session && session.sharerId === myUserId;

  // Cold-open hydrate
  useEffect(() => {
    let cancelled = false;
    void (async () => {
      try {
        const active = await getJson<LocationShareSession | null>(
          `/conversations/${conversationId}/location-session`,
        );
        if (!cancelled && active?.status === 'active') {
          setSession(active);
        }
      } catch {
        // non-blocking
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [conversationId]);

  // Socket listeners
  useEffect(() => {
    const unsubStarted = on('location:share:started', (e) => {
      if (e.session.conversationId !== conversationId) return;
      setSession(e.session);
      dispatch(messageReceived(e.message));
    });
    const unsubUpdate = on('location:share:update', (e) => {
      if (e.conversationId !== conversationId) return;
      setSession((prev) =>
        prev && prev.id === e.sessionId
          ? {
              ...prev,
              lastLocation: e.location,
              lastUpdatedAt: e.updatedAt,
            }
          : prev,
      );
    });
    const unsubEnded = on('location:share:ended', (e) => {
      if (e.conversationId !== conversationId) return;
      setSession((prev) => (prev && prev.id === e.sessionId ? null : prev));
    });
    return () => {
      unsubStarted();
      unsubUpdate();
      unsubEnded();
    };
  }, [on, conversationId, dispatch]);

  const emitUpdate = useCallback(
    async (location: ChatLocation): Promise<void> => {
      const s = sessionRef.current;
      if (!s || s.sharerId !== myUserId || s.status !== 'active') return;
      const now = Date.now();
      if (now - lastEmitRef.current < MIN_EMIT_MS) return;
      lastEmitRef.current = now;
      // Optimistic local pin before ack
      setSession((prev) =>
        prev && prev.id === s.id
          ? { ...prev, lastLocation: location, lastUpdatedAt: new Date().toISOString() }
          : prev,
      );
      const ok = await locationShareUpdate(s.id, location);
      if (ok) {
        setSession((prev) =>
          prev && prev.id === s.id
            ? { ...prev, lastLocation: location, lastUpdatedAt: ok.updatedAt }
            : prev,
        );
      }
    },
    [myUserId],
  );

  // The authenticated app owns the only continuous native GPS watcher in
  // UserLocationProvider. Live sharing consumes that shared stream.
  useEffect(() => {
    if (
      !isSharer ||
      session?.status !== 'active' ||
      !connected ||
      sharedLat == null ||
      sharedLng == null
    ) {
      return;
    }

    const location = { lat: sharedLat, lng: sharedLng };
    latestCoordsRef.current = location;
    void emitUpdate(location);
  }, [
    isSharer,
    session?.id,
    session?.status,
    connected,
    sharedLat,
    sharedLng,
    emitUpdate,
  ]);

  // Preserve the existing heartbeat cadence for active live-share sessions even
  // when the device has not moved enough to produce a new shared GPS fix.
  useEffect(() => {
    if (!isSharer || session?.status !== 'active' || !connected) return;

    const interval = setInterval(() => {
      const location = latestCoordsRef.current;
      if (location) void emitUpdate(location);
    }, FALLBACK_INTERVAL_MS);

    return () => clearInterval(interval);
  }, [isSharer, session?.id, session?.status, connected, emitUpdate]);

  const start = useCallback(
    async (duration: LocationShareDuration): Promise<void> => {
      if (starting) return;
      setStarting(true);
      try {
        // Sharing is a direct user action, so the shared location owner may
        // present native permission UI and wait for its provider-owned first fix.
        const location = await getCurrentLocation({ requestPermission: true });
        if (!location) {
          appAlert(
            'Location unavailable',
            'Allow location access to share your live location.',
          );
          return;
        }
        latestCoordsRef.current = location;
        const result = await locationShareStart(conversationId, duration, location);
        if (!result) {
          appAlert('Could not share location', 'Check your connection and try again.');
          return;
        }
        // Server assigns session id — apply as soon as ack arrives (socket may also fan-out).
        setSession(result);
      } finally {
        setStarting(false);
      }
    },
    [starting, getCurrentLocation, conversationId],
  );

  const stop = useCallback(async (): Promise<void> => {
    const s = sessionRef.current;
    if (!s || s.sharerId !== myUserId || stopping) return;

    // Optimistic: hide banner/session immediately; restore if stop fails.
    const snapshot = s;
    setSession(null);
    setStopping(true);
    try {
      const ok = await locationShareStop(snapshot.id);
      if (!ok) {
        setSession(snapshot);
        appAlert('Could not stop sharing', 'Try again in a moment.');
      }
    } catch {
      setSession(snapshot);
      appAlert('Could not stop sharing', 'Try again in a moment.');
    } finally {
      setStopping(false);
    }
  }, [myUserId, stopping]);

  const openInMaps = useCallback((): void => {
    const loc = session?.lastLocation;
    if (!loc) return;
    const { lat, lng } = loc;
    const url =
      Platform.OS === 'ios'
        ? `maps:0,0?q=${lat},${lng}`
        : `geo:${lat},${lng}?q=${lat},${lng}`;
    void Linking.openURL(url).catch(() => {
      void Linking.openURL(`https://maps.google.com/?q=${lat},${lng}`);
    });
  }, [session?.lastLocation]);

  return {
    session,
    starting,
    stopping,
    isSharer,
    start,
    stop,
    openInMaps,
  };
}
