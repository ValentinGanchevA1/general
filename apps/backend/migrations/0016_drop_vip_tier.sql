-- 0016_drop_vip_tier.sql — Retire the VIP subscription tier.
--
-- Paid tiers are now just basic + premium. Any existing 'vip' rows are
-- downgraded to 'premium' before the CHECK is tightened so the constraint
-- swap can't fail on legacy data. The inline CHECK from 0012 is auto-named
-- users_subscription_tier_check.

UPDATE users SET subscription_tier = 'premium' WHERE subscription_tier = 'vip';

ALTER TABLE users DROP CONSTRAINT IF EXISTS users_subscription_tier_check;
ALTER TABLE users ADD CONSTRAINT users_subscription_tier_check
  CHECK (subscription_tier IN ('free', 'basic', 'premium'));
