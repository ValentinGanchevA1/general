-- 0063_marketplace_kind.sql
-- First-class Marketplace content type, separate from listing buy/sell intent.
-- Existing rows are backfilled conservatively from title/category, then future
-- Marketplace creation writes an explicit kind.

ALTER TABLE listings
  ADD COLUMN IF NOT EXISTS marketplace_kind text NOT NULL DEFAULT 'for_sale';

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'listings_marketplace_kind_check'
  ) THEN
    ALTER TABLE listings
      ADD CONSTRAINT listings_marketplace_kind_check
      CHECK (marketplace_kind IN ('for_sale', 'service', 'job', 'local_deal'));
  END IF;
END $$;

-- Preserve the useful classification from the first Marketplace UI rollout.
UPDATE listings
   SET marketplace_kind = CASE
     WHEN lower(coalesce(category, '') || ' ' || coalesce(title, '')) ~
          '(job|jobs|hiring|employment|vacancy|freelance|gig)'
       THEN 'job'
     WHEN lower(coalesce(category, '') || ' ' || coalesce(title, '')) ~
          '(service|services|cleaning|electrician|plumber|repair|tutor|beauty|web development)'
       THEN 'service'
     WHEN lower(coalesce(category, '') || ' ' || coalesce(title, '')) ~
          '(local deal|deal|deals|promotion|discount|special offer|coupon)'
       THEN 'local_deal'
     ELSE 'for_sale'
   END
 WHERE mode = 'sell'
   AND marketplace_kind = 'for_sale';

CREATE INDEX IF NOT EXISTS listings_marketplace_kind_active_idx
  ON listings (marketplace_kind, created_at DESC)
  WHERE deleted_at IS NULL AND status = 'active' AND mode = 'sell';

-- Keep discovery metadata aligned with the newest listing projection (0044),
-- adding marketplaceKind without changing the top-level discovery entity kind.
CREATE OR REPLACE VIEW v_discoverable_entity AS
  SELECT
    u.id,
    'user'::text AS kind,
    u.location,
    u.location_h3_r4, u.location_h3_r5, u.location_h3_r6,
    u.location_h3_r7, u.location_h3_r8, u.location_h3_r9, u.location_h3_r10,
    u.visibility,
    jsonb_build_object(
      'displayName',  u.display_name,
      'avatarUrl',    u.avatar_url,
      'verification', u.verification_level,
      'online',       false,
      'lastSeenAt',   NULL,
      'verifiedBadge', u.id_verification_status = 'verified'
    ) AS meta
  FROM users u
  WHERE u.deleted_at IS NULL AND u.location IS NOT NULL

  UNION ALL

  SELECT
    e.id,
    'event'::text AS kind,
    e.location,
    e.location_h3_r4, e.location_h3_r5, e.location_h3_r6,
    e.location_h3_r7, e.location_h3_r8, e.location_h3_r9, e.location_h3_r10,
    e.visibility,
    jsonb_build_object(
      'title',            e.title,
      'coverUrl',         e.cover_url,
      'startsAt',         e.starts_at,
      'attendeeCount',    e.attendee_count,
      'capacity',         e.capacity,
      'hostId',           e.host_id,
      'hostDisplayName',  host.display_name
    ) AS meta
  FROM events e
  INNER JOIN users host ON host.id = e.host_id
  WHERE e.deleted_at IS NULL AND e.starts_at > NOW() - interval '1 day'

  UNION ALL

  SELECT
    l.id,
    'listing'::text AS kind,
    l.location,
    l.location_h3_r4, l.location_h3_r5, l.location_h3_r6,
    l.location_h3_r7, l.location_h3_r8, l.location_h3_r9, l.location_h3_r10,
    l.visibility,
    jsonb_build_object(
      'title',              l.title,
      'thumbnailUrl',       l.thumbnail_url,
      'priceCents',         l.price_cents,
      'currency',           l.currency,
      'category',           l.category,
      'mode',               l.mode,
      'marketplaceKind',    l.marketplace_kind,
      'sellerId',           l.seller_id,
      'sellerDisplayName',  seller.display_name,
      'createdAt',          l.created_at,
      'expiresAt',          l.expires_at,
      'bumpedAt',           l.bumped_at
    ) AS meta
  FROM listings l
  INNER JOIN users seller ON seller.id = l.seller_id
  WHERE l.deleted_at IS NULL
    AND l.status = 'active'
    AND (l.expires_at IS NULL OR l.expires_at > NOW());
