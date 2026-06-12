-- 0024_trading.sql — P3.7 trading: offers + favorites on top of `listings`.
--
-- The `listings` table already exists from 0001_initial.sql (seller, title,
-- price_cents, currency, category, status active/sold/withdrawn, location/H3)
-- and already feeds v_discoverable_entity, so listings ride the existing map +
-- discovery. This migration adds the two surfaces the trading epic needs:
--   • trade_offers    — a buyer's offer on a listing (offer-based v1; NO payment
--                       processing — Stripe Connect/checkout stays P4-deferred).
--   • trade_favorites — dedup'd "save for later".
--
-- Idempotent (guarded DDL) — safe to re-run.

-- ─── Offers ───────────────────────────────────────────────────────────────────
-- One (upsertable) offer per buyer per listing. offer_cents NULL = "interested
-- at the asking price". Seller responds: accepted / declined; buyer can withdraw.
CREATE TABLE IF NOT EXISTS trade_offers (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  listing_id  uuid NOT NULL REFERENCES listings(id) ON DELETE CASCADE,
  buyer_id    uuid NOT NULL REFERENCES users(id)    ON DELETE CASCADE,
  message     text,
  offer_cents integer CHECK (offer_cents IS NULL OR offer_cents >= 0),
  status      text NOT NULL DEFAULT 'pending'
              CHECK (status IN ('pending','accepted','declined','withdrawn')),
  created_at  timestamptz NOT NULL DEFAULT NOW(),
  updated_at  timestamptz NOT NULL DEFAULT NOW(),
  UNIQUE (listing_id, buyer_id)
);

CREATE INDEX IF NOT EXISTS trade_offers_listing_idx ON trade_offers (listing_id, status);
CREATE INDEX IF NOT EXISTS trade_offers_buyer_idx   ON trade_offers (buyer_id);

-- ─── Favorites (save for later) ───────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS trade_favorites (
  listing_id uuid NOT NULL REFERENCES listings(id) ON DELETE CASCADE,
  user_id    uuid NOT NULL REFERENCES users(id)    ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT NOW(),
  PRIMARY KEY (listing_id, user_id)
);

CREATE INDEX IF NOT EXISTS trade_favorites_user_idx ON trade_favorites (user_id, created_at DESC);
