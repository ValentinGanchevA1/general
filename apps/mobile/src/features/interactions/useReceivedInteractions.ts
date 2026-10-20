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
  markSeen: (seenThrough?: string) => void;
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
      // Keep the previous projection on transient failures.
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void Promise.resolve().then(() => {
      void refresh();
    });
  }, [refresh]);

  useEffect(
    () =>
      onSocketConnected(() => {
        void refresh();
      }),
    [refresh],
  );

  useEffect(() => {
    const unsub = on('wave:received', () => {
      void refresh();
    });
    return unsub;
  }, [on, refresh]);

  const unreadCount = items.filter((i) => new Date(i.createdAt).getTime() > seenAt).length;

  const markSeen = useCallback((seenThrough?: string): void => {
    // Opening the Interactions hub is not a read action. Callers must identify
    // the activity timestamp the user actually opened/acted on.
    if (!seenThrough) return;
    const timestamp = new Date(seenThrough).getTime();
    if (!Number.isFinite(timestamp)) return;
    markInboxSeen(Math.max(getInboxSeenAt(), timestamp));
  }, []);

  return { items, unreadCount, loading, refresh, markSeen };
}
