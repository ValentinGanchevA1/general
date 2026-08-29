-- 0036_listing_mode.sql
-- First-class sell / buy mode on listings (was client-only "Wanted:" prefix).
-- Existing rows default to sell. Discovery view meta includes mode for map markers.

ALTER TABLE listings
  ADD COLUMN IF NOT EXISTS mode text NOT NULL DEFAULT 'sell';

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'listings_mode_check'
  ) THEN
    ALTER TABLE listings
      ADD CONSTRAINT listings_mode_check CHECK (mode IN ('sell', 'buy'));
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS listings_mode_idx
  ON listings (mode)
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
      'title',         e.title,
      'coverUrl',      e.cover_url,
      'startsAt',      e.starts_at,
      'attendeeCount', e.attendee_count,
      'capacity',      e.capacity
    ) AS meta
  FROM events e
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
      'title',         l.title,
      'thumbnailUrl',  l.thumbnail_url,
      'priceCents',    l.price_cents,
      'currency',      l.currency,
      'category',      l.category,
      'mode',          l.mode
    ) AS meta
  FROM listings l
  WHERE l.deleted_at IS NULL AND l.status = 'active';
