// apps/mobile/src/features/gifts/useGifts.ts
//
// Gift data hooks + the send mutation. Mirrors the gamification hooks: read via
// getJson, keep stale data on error, expose a refresh().

import { useCallback, useEffect, useState } from 'react';

import type {
  GiftBalance,
  GiftCatalogItem,
  GiftSentResult,
  ReceivedGift,
  SendGiftRequest,
} from '@g88/shared';
import { getJson, postJson } from '@/api/client';

/** The active gift catalog (static-ish — fetched once). */
export function useGiftCatalog(): { catalog: GiftCatalogItem[]; loading: boolean } {
  const [catalog, setCatalog] = useState<GiftCatalogItem[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    let alive = true;
    setLoading(true);
    void getJson<GiftCatalogItem[]>('/gifts/catalog')
      .then((c) => { if (alive) setCatalog(c); })
      .catch(() => { /* keep empty on error */ })
      .finally(() => { if (alive) setLoading(false); });
    return () => { alive = false; };
  }, []);

  return { catalog, loading };
}

/** The caller's spendable XP wallet balance. */
export function useGiftBalance(): { spendableXp: number; loading: boolean; refresh: () => void } {
  const [spendableXp, setSpendableXp] = useState(0);
  const [loading, setLoading] = useState(false);

  const refresh = useCallback(() => {
    setLoading(true);
    void getJson<GiftBalance>('/gifts/balance')
      .then((b) => setSpendableXp(b.spendableXp))
      .catch(() => { /* keep stale on error */ })
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => { refresh(); }, [refresh]);
  return { spendableXp, loading, refresh };
}

/** The caller's gift inbox (reading it marks everything seen server-side). */
export function useReceivedGifts(): { gifts: ReceivedGift[]; loading: boolean; refresh: () => void } {
  const [gifts, setGifts] = useState<ReceivedGift[]>([]);
  const [loading, setLoading] = useState(false);

  const refresh = useCallback(() => {
    setLoading(true);
    void getJson<ReceivedGift[]>('/gifts/received')
      .then(setGifts)
      .catch(() => { /* keep stale on error */ })
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => { refresh(); }, [refresh]);
  return { gifts, loading, refresh };
}

/** Spend XP to send a gift. Throws ApiError (e.g. code 'gift.insufficient_xp'). */
export function sendGift(req: SendGiftRequest): Promise<GiftSentResult> {
  return postJson<SendGiftRequest, GiftSentResult>('/gifts/send', req);
}
