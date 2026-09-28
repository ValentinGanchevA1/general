// apps/mobile/src/features/gifts/useGifts.ts
//
// Gift data hooks + the send mutation. Reads via useAsyncResource (error + Sentry).

import { useEffect, useState } from 'react';

import type {
  GiftBalance,
  GiftCatalogItem,
  GiftSentResult,
  ReceivedGift,
  SendGiftRequest,
  SentGift,
} from '@g88/shared';
import { getJson, postJson } from '@/api/client';
import { useAsyncResource } from '@/features/common/useAsyncResource';

/** The active gift catalog (static-ish — fetched once). */
export function useGiftCatalog(): {
  catalog: GiftCatalogItem[];
  loading: boolean;
  error: unknown | null;
} {
  const [catalog, setCatalog] = useState<GiftCatalogItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<unknown | null>(null);

  useEffect(() => {
    let alive = true;
    void (async () => {
      setLoading(true);
      try {
        const c = await getJson<GiftCatalogItem[]>('/gifts/catalog');
        if (alive) {
          setCatalog(c);
          setError(null);
        }
      } catch (err) {
        if (alive) setError(err);
      } finally {
        if (alive) setLoading(false);
      }
    })();
    return () => {
      alive = false;
    };
  }, []);

  return { catalog, loading, error };
}

/** The caller's spendable XP wallet balance. */
export function useGiftBalance(): {
  spendableXp: number;
  loading: boolean;
  error: unknown | null;
  refresh: () => void;
} {
  const { data, loading, error, refresh } = useAsyncResource<number>({
    resourceKey: 'gifts.balance',
    fetcher: async () => {
      const b = await getJson<GiftBalance>('/gifts/balance');
      return b.spendableXp;
    },
    initialData: 0,
  });

  return { spendableXp: data, loading, error, refresh };
}

/** The caller's gift inbox (reading it marks everything seen server-side). */
export function useReceivedGifts(): {
  gifts: ReceivedGift[];
  loading: boolean;
  error: unknown | null;
  refresh: () => void;
} {
  const { data, loading, error, refresh } = useAsyncResource<ReceivedGift[]>({
    resourceKey: 'gifts.received',
    fetcher: () => getJson<ReceivedGift[]>('/gifts/received'),
    initialData: [],
  });

  return { gifts: data, loading, error, refresh };
}

/** Gifts the caller has sent (no side effects). */
export function useSentGifts(): {
  gifts: SentGift[];
  loading: boolean;
  error: unknown | null;
  refresh: () => void;
} {
  const { data, loading, error, refresh } = useAsyncResource<SentGift[]>({
    resourceKey: 'gifts.sent',
    fetcher: () => getJson<SentGift[]>('/gifts/sent'),
    initialData: [],
  });

  return { gifts: data, loading, error, refresh };
}

/** Spend XP to send a gift. Throws ApiError (e.g. code 'gift.insufficient_xp'). */
export function sendGift(req: SendGiftRequest): Promise<GiftSentResult> {
  return postJson<SendGiftRequest, GiftSentResult>('/gifts/send', req);
}
