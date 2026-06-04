// packages/shared/src/gifts.ts
//
// XP-funded gifts (no real money in v1). A user spends `spendable_xp` from their
// wallet to send a catalog gift to another user; the recipient earns a small,
// daily-capped 'gift.received' XP reward. The lifetime score (total_xp) that
// drives level + leaderboard is never spent — see gamification.ts.

/** A purchasable gift. The catalog is fixed/seeded; the client reads it. */
export interface GiftCatalogItem {
  id: string; // 'rose', 'coffee', 'trophy'
  label: string;
  emoji: string;
  costXp: number;
}

/** POST /gifts/send body. */
export interface SendGiftRequest {
  recipientId: string;
  giftId: string;
  /** Optional note, max 200 chars. */
  message?: string;
}

/** Result of a successful send. */
export interface GiftSentResult {
  giftId: string;
  /** Sender's wallet balance after the spend. */
  spendableXp: number;
}

/** GET /gifts/balance. */
export interface GiftBalance {
  spendableXp: number;
}

/** A gift in the recipient's inbox (GET /gifts/received), display-ready. */
export interface ReceivedGift {
  id: string;
  giftId: string;
  emoji: string;
  label: string;
  message: string | null;
  sender: { id: string; displayName: string; avatarUrl: string | null };
  seenAt: string | null;
  createdAt: string;
}
