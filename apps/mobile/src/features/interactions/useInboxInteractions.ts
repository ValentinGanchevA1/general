import { useCallback, useEffect, useRef, useState } from 'react';
import { useFocusEffect } from '@react-navigation/native';

import type { InboxItem, InboxResponse } from '@g88/shared';

import { getJson } from '@/api/client';
import { onSocketConnected, useSocket } from '@/realtime/useSocket';

export function useInboxInteractions(): {
  items: InboxItem[];
  loading: boolean;
  refresh: () => Promise<void>;
} {
  const [items, setItems] = useState<InboxItem[]>([]);
  const [loading, setLoading] = useState(true);
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
    // Coalesce concurrent refreshes (focus + socket + Accept can overlap).
    if (inFlightRef.current) {
      await inFlightRef.current;
      return;
    }

    const run = (async () => {
      try {
        const res = await getJson<InboxResponse>('/interactions/inbox?limit=50');
        if (mountedRef.current) {
          setItems(res.items);
        }
      } catch (err) {
        if (__DEV__) {
          console.warn('[inbox] /interactions/inbox failed', err);
        }
        // Keep previous items on transient failure.
      } finally {
        if (mountedRef.current) {
          setLoading(false);
        }
      }
    })();

    inFlightRef.current = run;
    try {
      await run;
    } finally {
      if (inFlightRef.current === run) {
        inFlightRef.current = null;
      }
    }
  }, []);

  // Initial load (screen may not focus-fire on first mount in some navigators).
  useEffect(() => {
    void Promise.resolve().then(() => {
      void refresh();
    });
  }, [refresh]);

  // Re-fetch when Interactions regains focus — covers accept/auto-accept on
  // UserProfile then navigating back with a still-mounted list.
  useFocusEffect(
    useCallback(() => {
      void refresh();
    }, [refresh]),
  );

  // Heal list after reconnect (events may have been missed while offline).
  useEffect(
    () =>
      onSocketConnected(() => {
        void refresh();
      }),
    [refresh],
  );

  useEffect(() => {
    const unsubWave = on('wave:received', () => {
      void refresh();
    });
    // New inbound request → show Accept/Decline row.
    const unsubFriendReq = on('friend:request', () => {
      void refresh();
    });
    // Peer accepted *our* outbound request → drop stale pending rows if any.
    // (Acceptor path is covered by useFocusEffect after profile/Interactions Accept.)
    const unsubFriendAcc = on('friend:accepted', () => {
      void refresh();
    });
    return () => {
      unsubWave();
      unsubFriendReq();
      unsubFriendAcc();
    };
  }, [on, refresh]);

  return { items, loading, refresh };
}
