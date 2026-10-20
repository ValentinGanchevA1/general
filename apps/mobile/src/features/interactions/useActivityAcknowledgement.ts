import { useCallback, useEffect, useMemo, useState } from 'react';

import type { InboxItem } from '@g88/shared';

import { activityAcknowledgementAt, hasUnseenActivity } from './activityAcknowledgement';
import { getInboxSeenAt, markInboxSeen, subscribeInboxSeen } from './inboxSeen';

export function useActivityAcknowledgement(items: readonly InboxItem[]): {
  hasUnseen: boolean;
  acknowledge: () => void;
} {
  const [seenAtMs, setSeenAtMs] = useState<number>(() => getInboxSeenAt());

  useEffect(
    () => subscribeInboxSeen(() => setSeenAtMs(getInboxSeenAt())),
    [],
  );

  const hasUnseen = useMemo(
    () => hasUnseenActivity(items, seenAtMs),
    [items, seenAtMs],
  );

  const acknowledge = useCallback((): void => {
    // Capture the current projection first. A socket/refetch that adds a newer
    // item after this point must remain unseen.
    const acknowledgedAtMs = activityAcknowledgementAt(items);
    if (acknowledgedAtMs == null) return;
    markInboxSeen(acknowledgedAtMs);
  }, [items]);

  return { hasUnseen, acknowledge };
}
