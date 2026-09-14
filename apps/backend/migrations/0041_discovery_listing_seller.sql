-- 0041_discovery_listing_seller.sql
-- Expose sellerId on listing discovery meta so the map sheet can open Message seller
-- without a second listing fetch. View-only change; no table ALTER.

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
      'mode',          l.mode,
      'sellerId',      l.seller_id
    ) AS meta
  FROM listings l
  WHERE l.deleted_at IS NULL AND l.status = 'active';
