import { useEffect, useMemo, useState } from 'react';

import { fetchConversations } from '@/features/chat/chatSlice';
import { useAppDispatch, useAppSelector } from '@/hooks/redux';
import { onSocketConnected, useSocket } from '@/realtime/useSocket';

import { interactionsBadgeCounts, interactionsBadgeLabel } from './interactionsBadge';
import {
  getInboxSeenAt,
  hydrateInboxSeen,
  isInboxSeenHydrated,
  resetInboxSeen,
  subscribeInboxSeen,
} from './inboxSeen';
import { useInboxInteractions } from './useInboxInteractions';

export function useInteractionsBadge(): {
  total: number;
  label: string | undefined;
  ready: boolean;
} {
  const dispatch = useAppDispatch();
  const userId = useAppSelector((state) => state.auth.user?.id ?? null);
  const conversations = useAppSelector((state) => state.chat.conversations);
  const { items } = useInboxInteractions();
  const { on } = useSocket();
  const [seenAtMs, setSeenAtMs] = useState(getInboxSeenAt);
  const [ready, setReady] = useState(isInboxSeenHydrated);

  useEffect(
    () =>
      subscribeInboxSeen(() => {
        setSeenAtMs(getInboxSeenAt());
        setReady(isInboxSeenHydrated());
      }),
    [],
  );

  useEffect(() => {
    if (!userId) {
      resetInboxSeen();
      return;
    }

    void hydrateInboxSeen(userId);
    void dispatch(fetchConversations());
  }, [dispatch, userId]);

  useEffect(
    () =>
      onSocketConnected(() => {
        if (userId) void dispatch(fetchConversations());
      }),
    [dispatch, userId],
  );

  useEffect(() => {
    const unsub = on('chat:message', () => {
      if (userId) void dispatch(fetchConversations());
    });
    return unsub;
  }, [dispatch, on, userId]);

  const counts = useMemo(
    () => interactionsBadgeCounts(items, conversations, seenAtMs),
    [items, conversations, seenAtMs],
  );

  const total = ready ? counts.total : 0;
  return { total, label: interactionsBadgeLabel(total), ready };
}
