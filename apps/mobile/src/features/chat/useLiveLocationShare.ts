import { useCallback, useEffect, useRef, useState } from 'react';
import { Linking, Platform } from 'react-native';

import { appAlert } from '@/ui/appAlert';
import Geolocation from '@react-native-community/geolocation';

import type {
  ChatLocation,
  LocationShareDuration,
  LocationShareSession,
} from '@g88/shared';

import { getJson } from '@/api/client';
import { useAppDispatch, useAppSelector } from '@/hooks/redux';
import { messageReceived } from '@/features/chat/chatSlice';
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

  const [session, setSession] = useState<LocationShareSession | null>(null);
  const [starting, setStarting] = useState(false);
  const [stopping, setStopping] = useState(false);

  const sessionRef = useRef<LocationShareSession | null>(null);
  const lastEmitRef = useRef(0);
  const watchIdRef = useRef<number | null>(null);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
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

  // GPS watch while we are the sharer of an active session
  useEffect(() => {
    if (!isSharer || !session || !connected) {
      if (watchIdRef.current !== null) {
        Geolocation.clearWatch(watchIdRef.current);
        watchIdRef.current = null;
      }
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
        intervalRef.current = null;
      }
      return;
    }

    if (watchIdRef.current === null) {
      watchIdRef.current = Geolocation.watchPosition(
        (pos) => {
          const loc = { lat: pos.coords.latitude, lng: pos.coords.longitude };
          latestCoordsRef.current = loc;
          void emitUpdate(loc);
        },
        () => undefined,
        { enableHighAccuracy: true, distanceFilter: 25 },
      );
    }

    if (!intervalRef.current) {
      intervalRef.current = setInterval(() => {
        const loc = latestCoordsRef.current;
        if (loc) void emitUpdate(loc);
      }, FALLBACK_INTERVAL_MS);
    }

    return () => {
      if (watchIdRef.current !== null) {
        Geolocation.clearWatch(watchIdRef.current);
        watchIdRef.current = null;
      }
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
        intervalRef.current = null;
      }
    };
  }, [isSharer, session?.id, connected, emitUpdate, session]);

  const getCurrentLocation = useCallback((): Promise<ChatLocation | null> => {
    return new Promise((resolve) => {
      Geolocation.getCurrentPosition(
        (pos) => resolve({ lat: pos.coords.latitude, lng: pos.coords.longitude }),
        () => resolve(null),
        { enableHighAccuracy: true, timeout: 15_000, maximumAge: 10_000 },
      );
    });
  }, []);

  const start = useCallback(
    async (duration: LocationShareDuration): Promise<void> => {
      if (starting) return;
      setStarting(true);
      try {
        const location = await getCurrentLocation();
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
