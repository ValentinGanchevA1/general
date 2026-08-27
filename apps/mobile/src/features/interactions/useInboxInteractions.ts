import { useCallback, useEffect, useState } from 'react';

import type { InboxItem, InboxResponse } from '@g88/shared';

import { getJson } from '@/api/client';
import { onSocketConnected, useSocket } from '@/realtime/useSocket';

/**
 * Single-fetch Interactions inbox (waves + reactions + friend requests + recent followers).
 * Backend aggregates; Friends Requests tab keeps its own endpoints for full list/pagination.
 */
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
        console.warn('[inbox] fetch failed', err);
      }
      // Keep prior items on transient failure so the surface does not flash empty.
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
