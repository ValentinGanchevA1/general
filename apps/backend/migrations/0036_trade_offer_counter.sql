-- 0036_trade_offer_counter.sql
-- Negotiation: track who last moved the offer price (buyer vs seller counter).
-- status stays pending after a seller counter so the buyer can accept/re-offer/withdraw.

ALTER TABLE trade_offers
  ADD COLUMN IF NOT EXISTS last_actor text
  CHECK (last_actor IS NULL OR last_actor IN ('buyer', 'seller'));

COMMENT ON COLUMN trade_offers.last_actor IS
  'buyer = latest amount from buyer; seller = seller counter-offer (status remains pending)';
