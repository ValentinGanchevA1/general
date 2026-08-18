import { useCallback, useEffect, useState } from 'react';

import type {
  FriendRequestsPage,
  InboxItem,
  ReceivedInteractionsResponse,
  RecentFollowersResponse,
} from '@g88/shared';

import { getJson } from '@/api/client';
import { useSocket } from '@/realtime/useSocket';

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
      const [waves, requests, followers] = await Promise.all([
        getJson<ReceivedInteractionsResponse>('/interactions/received?limit=50'),
        getJson<FriendRequestsPage>('/friends/requests/pending'),
        getJson<RecentFollowersResponse>('/friends/followers/recent?sinceDays=14&limit=30'),
      ]);

      const mapped: InboxItem[] = [
        ...waves.items.map(
          (w): InboxItem => ({
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
            reactionKind: w.reactionKind,
          }),
        ),
        ...requests.items.map(
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
        ...followers.items.map(
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
    } catch {
      // keep previous
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void Promise.resolve().then(() => {
      void refresh();
    });
  }, [refresh]);

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
