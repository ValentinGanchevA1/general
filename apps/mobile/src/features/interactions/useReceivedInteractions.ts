import { useCallback, useEffect, useState } from 'react';

import type { ReceivedInteraction, ReceivedInteractionsResponse } from '@g88/shared';

import { getJson } from '@/api/client';
import { onSocketConnected, useSocket } from '@/realtime/useSocket';

import { getInboxSeenAt, markInboxSeen, subscribeInboxSeen } from './inboxSeen';

export function useReceivedInteractions(): {
  items: ReceivedInteraction[];
  unreadCount: number;
  loading: boolean;
  refresh: () => Promise<void>;
  markSeen: () => void;
} {
  const [items, setItems] = useState<ReceivedInteraction[]>([]);
  const [loading, setLoading] = useState(true);
  const [seenAt, setSeenAt] = useState<number>(() => getInboxSeenAt());
  const { on } = useSocket();

  useEffect(() => subscribeInboxSeen(() => setSeenAt(getInboxSeenAt())), []);

  const refresh = useCallback(async (): Promise<void> => {
    try {
      const res = await getJson<ReceivedInteractionsResponse>('/interactions/received?limit=50');
      setItems(res.items);
    } catch {
      // keep previous
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    // Defer so setState inside refresh is not synchronous in the effect body (CI --max-warnings 0).
    void Promise.resolve().then(() => {
      void refresh();
    });
  }, [refresh]);

  // Refetch waves after reconnect so map 👋 badge stays honest.
  useEffect(() => onSocketConnected(() => {
    void refresh();
  }), [refresh]);

  useEffect(() => {
    const unsub = on('wave:received', () => {
      void refresh();
    });
    return unsub;
  }, [on, refresh]);

  const unreadCount = items.filter((i) => new Date(i.createdAt).getTime() > seenAt).length;

  const markSeen = useCallback((): void => {
    markInboxSeen(Date.now());
  }, []);

  return { items, unreadCount, loading, refresh, markSeen };
}
