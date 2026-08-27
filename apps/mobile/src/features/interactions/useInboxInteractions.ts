import { useCallback, useEffect, useState } from 'react';

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

  const refresh = useCallback(async (): Promise<void> => {
    try {
      const res = await getJson<InboxResponse>('/interactions/inbox?limit=50');
      setItems(res.items);
    } catch (err) {
      if (__DEV__) {
        console.warn('[inbox] /interactions/inbox failed', err);
      }
      // Keep previous items on transient failure (same spirit as allSettled).
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void Promise.resolve().then(() => {
      void refresh();
    });
  }, [refresh]);

  // Heal list after reconnect (events may have been missed while offline).
  useEffect(() => onSocketConnected(() => {
    void refresh();
  }), [refresh]);

  useEffect(() => {
    const unsubWave = on('wave:received', () => {
      void refresh();
    });
    const unsubFriend = on('friend:request', () => {
      void refresh();
    });
    return () => {
      unsubWave();
      unsubFriend();
    };
  }, [on, refresh]);

  return { items, loading, refresh };
}
