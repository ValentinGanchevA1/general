import { useCallback, useEffect, useState } from 'react';

import type {
  FriendRequestsPage,
  InboxItem,
  ReceivedInteractionsResponse,
  RecentFollowersResponse,
} from '@g88/shared';

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
    // allSettled: one failing source must not wipe waves / requests / followers.
    const [wavesRes, requestsRes, followersRes] = await Promise.allSettled([
      getJson<ReceivedInteractionsResponse>('/interactions/received?limit=50'),
      getJson<FriendRequestsPage>('/friends/requests/pending'),
      getJson<RecentFollowersResponse>('/friends/followers/recent?sinceDays=14&limit=30'),
    ]);

    const waves = wavesRes.status === 'fulfilled' ? wavesRes.value.items : [];
    const requests = requestsRes.status === 'fulfilled' ? requestsRes.value.items : [];
    const followers =
      followersRes.status === 'fulfilled' ? followersRes.value.items : [];

    if (__DEV__) {
      if (wavesRes.status === 'rejected') {
        console.warn('[inbox] waves failed', wavesRes.reason);
      }
      if (requestsRes.status === 'rejected') {
        console.warn('[inbox] friend requests failed', requestsRes.reason);
      }
      if (followersRes.status === 'rejected') {
        console.warn('[inbox] recent followers failed', followersRes.reason);
      }
    }

    const mapped: InboxItem[] = [
      ...waves.map((w): InboxItem => {
        const base: InboxItem = {
          id: `wave:${w.id}`,
          type: w.type === 'wave' ? 'wave' : 'story_reaction',
          createdAt: w.createdAt,
          fromUser: {
            id: w.fromUser.id,
            displayName: w.fromUser.displayName,
            avatarUrl: w.fromUser.avatarUrl,
            verification: w.fromUser.verification ?? null,
          },
          isMutual: w.isMutual,
        };
        if (w.reactionKind != null) {
          base.reactionKind = w.reactionKind;
        }
        return base;
      }),
      ...requests.map(
        (r): InboxItem => ({
          id: `fr:${r.id}`,
          type: 'friend_request',
          createdAt: r.createdAt,
          fromUser: {
            id: r.fromUserId,
            displayName: r.displayName,
            avatarUrl: r.avatarUrl,
          },
          requestId: r.id,
        }),
      ),
      ...followers.map(
        (f): InboxItem => ({
          id: `follow:${f.userId}:${f.createdAt}`,
          type: 'follow',
          createdAt: f.createdAt,
          fromUser: {
            id: f.userId,
            displayName: f.displayName,
            avatarUrl: f.avatarUrl,
          },
          isFollowingBack: f.isFollowingBack,
        }),
      ),
    ];

    mapped.sort((a, b) => +new Date(b.createdAt) - +new Date(a.createdAt));
    setItems(mapped);
    setLoading(false);
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
