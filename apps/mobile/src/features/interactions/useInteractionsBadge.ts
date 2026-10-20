import { useEffect, useMemo, useState } from 'react';

import { useAppSelector } from '@/hooks/redux';

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
  const userId = useAppSelector((state) => state.auth.user?.id ?? null);
  const conversations = useAppSelector((state) => state.chat.conversations);
  const { items } = useInboxInteractions();
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
  }, [userId]);

  const counts = useMemo(
    () => interactionsBadgeCounts(items, conversations, seenAtMs),
    [items, conversations, seenAtMs],
  );

  const total = ready ? counts.total : 0;
  return { total, label: interactionsBadgeLabel(total), ready };
}
