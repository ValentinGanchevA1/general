-- 0014_stripe_subscription.sql — Stripe linkage for subscriptions (G3).
--
-- subscription_tier already exists (0012, default 'free') and is the source of
-- truth read by the profile. These columns tie a user to their Stripe customer
-- and active subscription so the webhook can reconcile tier changes and the
-- billing portal can be opened. tier itself is only ever written by the webhook.

ALTER TABLE users
  ADD COLUMN IF NOT EXISTS stripe_customer_id     text,
  ADD COLUMN IF NOT EXISTS stripe_subscription_id text;

-- Webhook looks the user up by customer id on subscription events.
CREATE UNIQUE INDEX IF NOT EXISTS users_stripe_customer_idx
  ON users (stripe_customer_id)
  WHERE stripe_customer_id IS NOT NULL;
