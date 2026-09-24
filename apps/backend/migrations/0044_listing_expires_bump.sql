-- 0044_listing_expires_bump.sql
-- Listing urgency: TTL + bump. Expired active listings leave discovery.

ALTER TABLE listings
  ADD COLUMN IF NOT EXISTS expires_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS bumped_at TIMESTAMPTZ;

-- Backfill: 14d from created_at for still-active rows without an expiry.
UPDATE listings
   SET expires_at = created_at + interval '14 days'
 WHERE deleted_at IS NULL
   AND status = 'active'
   AND expires_at IS NULL;

CREATE INDEX IF NOT EXISTS listings_expires_at_active_idx
  ON listings (expires_at)
  WHERE deleted_at IS NULL AND status = 'active';

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
