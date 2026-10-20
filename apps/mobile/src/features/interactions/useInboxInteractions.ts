import { useCallback, useEffect, useRef, useState } from 'react';
import { useFocusEffect } from '@react-navigation/native';
import * as Sentry from '@sentry/react-native';

import type { InboxItem, InboxResponse } from '@g88/shared';

import { getJson } from '@/api/client';
import { onSocketConnected, useSocket } from '@/realtime/useSocket';

export function useInboxInteractions(): {
  items: InboxItem[];
  loading: boolean;
  error: unknown | null;
  refresh: () => Promise<void>;
} {
  const [items, setItems] = useState<InboxItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<unknown | null>(null);
  const { on } = useSocket();
  const mountedRef = useRef(true);
  const inFlightRef = useRef<Promise<void> | null>(null);

  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
    };
  }, []);

  const refresh = useCallback(async (): Promise<void> => {
    if (inFlightRef.current) {
      await inFlightRef.current;
      return;
    }

    const run = (async () => {
      try {
        const res = await getJson<InboxResponse>('/interactions/inbox?limit=50');
        if (mountedRef.current) {
          setItems(res.items);
          setError(null);
        }
      } catch (err) {
        Sentry.captureException(err, { tags: { resource: 'interactions.inbox' } });
        if (mountedRef.current) setError(err);
      } finally {
        if (mountedRef.current) setLoading(false);
      }
    })();

    inFlightRef.current = run;
    try {
      await run;
    } finally {
      if (inFlightRef.current === run) inFlightRef.current = null;
    }
  }, []);

  useEffect(() => {
    void Promise.resolve().then(() => {
      void refresh();
    });
  }, [refresh]);

  useFocusEffect(
    useCallback(() => {
      void refresh();
    }, [refresh]),
  );

  useEffect(
    () =>
      onSocketConnected(() => {
        void refresh();
      }),
    [refresh],
  );

  useEffect(() => {
    const unsubs = [
      on('wave:received', () => void refresh()),
      on('wave:mutual', () => void refresh()),
      on('friend:request', () => void refresh()),
      on('friend:accepted', () => void refresh()),
      on('gift:received', () => void refresh()),
    ];
    return () => {
      for (const unsub of unsubs) unsub();
    };
  }, [on, refresh]);

  return { items, loading, error, refresh };
}
