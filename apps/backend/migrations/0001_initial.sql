-- ───────────────────────────────────────────────────────────────────────────
-- 0001_initial.sql — G88 baseline schema
-- ───────────────────────────────────────────────────────────────────────────
-- Conventions:
--   * UUID v7 ids (time-sortable) generated client-side or via gen_uuid_v7().
--     Until pg_uuidv7 is widely available, gen_random_uuid() (UUID v4) is fine.
--   * `location` is geography(Point, 4326). Always.
--   * H3 cell columns are GENERATED (not triggers): a write of `location`
--     automatically populates all resolutions. No app code can forget.
--   * Soft delete via `deleted_at`. Hard-delete pipelines run weekly.

CREATE EXTENSION IF NOT EXISTS postgis;
CREATE EXTENSION IF NOT EXISTS h3;          -- pg_h3 from Zachary Deziel et al.
CREATE EXTENSION IF NOT EXISTS h3_postgis;  -- glue between PostGIS and h3
CREATE EXTENSION IF NOT EXISTS pgcrypto;    -- for gen_random_uuid()
CREATE EXTENSION IF NOT EXISTS citext;

-- ─── Users ────────────────────────────────────────────────────────────────

CREATE TABLE users (
  id                  uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  email               citext UNIQUE NOT NULL,
  password_hash       text NOT NULL,
  display_name        text NOT NULL,
  avatar_url          text,
  verification_level  text NOT NULL DEFAULT 'none'
                      CHECK (verification_level IN ('none','email','phone','selfie','id')),
  visibility          text NOT NULL DEFAULT 'public'
                      CHECK (visibility IN ('public','private','blocked')),

  -- Location is fuzzed at write-time in app code (snapped to r10 centroid).
  location            geography(Point, 4326),
  location_h3_r5      text GENERATED ALWAYS AS (h3_lat_lng_to_cell(location::geometry, 5)::text)  STORED,
  location_h3_r7      text GENERATED ALWAYS AS (h3_lat_lng_to_cell(location::geometry, 7)::text)  STORED,
  location_h3_r9      text GENERATED ALWAYS AS (h3_lat_lng_to_cell(location::geometry, 9)::text)  STORED,
  location_h3_r10     text GENERATED ALWAYS AS (h3_lat_lng_to_cell(location::geometry, 10)::text) STORED,

  created_at          timestamptz NOT NULL DEFAULT NOW(),
  updated_at          timestamptz NOT NULL DEFAULT NOW(),
  deleted_at          timestamptz
);

CREATE INDEX users_location_gix      ON users USING GIST (location);
CREATE INDEX users_h3_r5_idx         ON users (location_h3_r5);
CREATE INDEX users_h3_r7_idx         ON users (location_h3_r7);
CREATE INDEX users_h3_r9_idx         ON users (location_h3_r9);
CREATE INDEX users_h3_r10_idx        ON users (location_h3_r10);
CREATE INDEX users_visibility_idx    ON users (visibility) WHERE deleted_at IS NULL;

-- ─── Events ───────────────────────────────────────────────────────────────

CREATE TABLE events (
  id                  uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  host_id             uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  title               text NOT NULL,
  description         text,
  cover_url           text,
  starts_at           timestamptz NOT NULL,
  ends_at             timestamptz,
  capacity            integer,
  attendee_count      integer NOT NULL DEFAULT 0,
  visibility          text NOT NULL DEFAULT 'public'
                      CHECK (visibility IN ('public','private')),

  location            geography(Point, 4326) NOT NULL,
  location_h3_r5      text GENERATED ALWAYS AS (h3_lat_lng_to_cell(location::geometry, 5)::text)  STORED,
  location_h3_r7      text GENERATED ALWAYS AS (h3_lat_lng_to_cell(location::geometry, 7)::text)  STORED,
  location_h3_r9      text GENERATED ALWAYS AS (h3_lat_lng_to_cell(location::geometry, 9)::text)  STORED,
  location_h3_r10     text GENERATED ALWAYS AS (h3_lat_lng_to_cell(location::geometry, 10)::text) STORED,

  created_at          timestamptz NOT NULL DEFAULT NOW(),
  updated_at          timestamptz NOT NULL DEFAULT NOW(),
  deleted_at          timestamptz
);

CREATE INDEX events_location_gix     ON events USING GIST (location);
CREATE INDEX events_h3_r7_idx        ON events (location_h3_r7);
CREATE INDEX events_h3_r9_idx        ON events (location_h3_r9);
CREATE INDEX events_starts_at_idx    ON events (starts_at) WHERE deleted_at IS NULL;

-- ─── Listings ─────────────────────────────────────────────────────────────

CREATE TABLE listings (
  id                  uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  seller_id           uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  title               text NOT NULL,
  description         text,
  thumbnail_url       text,
  price_cents         integer NOT NULL CHECK (price_cents >= 0),
  currency            char(3) NOT NULL DEFAULT 'USD',
  category            text NOT NULL,
  status              text NOT NULL DEFAULT 'active'
                      CHECK (status IN ('active','sold','withdrawn')),
  visibility          text NOT NULL DEFAULT 'public'
                      CHECK (visibility IN ('public','private')),

  location            geography(Point, 4326) NOT NULL,
  location_h3_r5      text GENERATED ALWAYS AS (h3_lat_lng_to_cell(location::geometry, 5)::text)  STORED,
  location_h3_r7      text GENERATED ALWAYS AS (h3_lat_lng_to_cell(location::geometry, 7)::text)  STORED,
  location_h3_r9      text GENERATED ALWAYS AS (h3_lat_lng_to_cell(location::geometry, 9)::text)  STORED,
  location_h3_r10     text GENERATED ALWAYS AS (h3_lat_lng_to_cell(location::geometry, 10)::text) STORED,

  created_at          timestamptz NOT NULL DEFAULT NOW(),
  updated_at          timestamptz NOT NULL DEFAULT NOW(),
  deleted_at          timestamptz
);

CREATE INDEX listings_location_gix   ON listings USING GIST (location);
CREATE INDEX listings_h3_r7_idx      ON listings (location_h3_r7);
CREATE INDEX listings_h3_r9_idx      ON listings (location_h3_r9);
CREATE INDEX listings_status_idx     ON listings (status) WHERE deleted_at IS NULL;

-- ─── Conversations & messages ─────────────────────────────────────────────

CREATE TABLE conversations (
  id                  uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  participant_ids     uuid[] NOT NULL,
  created_at          timestamptz NOT NULL DEFAULT NOW(),
  last_message_at     timestamptz
);
-- Sorted array gives us a stable uniqueness key for 1:1 chats.
CREATE UNIQUE INDEX conversations_participants_uniq
  ON conversations (participant_ids)
  WHERE array_length(participant_ids, 1) = 2;

CREATE TABLE messages (
  id                  uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  conversation_id     uuid NOT NULL REFERENCES conversations(id) ON DELETE CASCADE,
  sender_id           uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  body                text NOT NULL,
  created_at          timestamptz NOT NULL DEFAULT NOW()
);
CREATE INDEX messages_convo_created_idx ON messages (conversation_id, created_at DESC);

-- ─── Waves ────────────────────────────────────────────────────────────────

CREATE TABLE waves (
  id                  uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  from_user_id        uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  to_user_id          uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  context             text NOT NULL DEFAULT 'map'
                      CHECK (context IN ('map','profile','event')),
  conversation_id     uuid REFERENCES conversations(id),
  responded_at        timestamptz,
  created_at          timestamptz NOT NULL DEFAULT NOW(),
  CHECK (from_user_id <> to_user_id)
);
CREATE INDEX waves_from_to_created_idx ON waves (from_user_id, to_user_id, created_at DESC);
CREATE INDEX waves_to_created_idx      ON waves (to_user_id, created_at DESC);

-- ─── Device tokens (push) ─────────────────────────────────────────────────

CREATE TABLE device_tokens (
  id                  uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id             uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  platform            text NOT NULL CHECK (platform IN ('ios','android')),
  token               text NOT NULL,
  last_seen_at        timestamptz NOT NULL DEFAULT NOW(),
  UNIQUE (user_id, token)
);

-- ─── Discoverable entity view ─────────────────────────────────────────────
-- The discovery query reads from here so it never has to UNION at request time.
-- `meta` is a jsonb projection of the per-kind fields the client needs.

CREATE OR REPLACE VIEW v_discoverable_entity AS
  SELECT
    u.id,
    'user'::text AS kind,
    u.location,
    u.location_h3_r5, u.location_h3_r7, u.location_h3_r9, u.location_h3_r10,
    u.visibility,
    jsonb_build_object(
      'displayName',  u.display_name,
      'avatarUrl',    u.avatar_url,
      'verification', u.verification_level,
      'online',       false,
      'lastSeenAt',   NULL
    ) AS meta
  FROM users u
  WHERE u.deleted_at IS NULL AND u.location IS NOT NULL

  UNION ALL

  SELECT
    e.id,
    'event'::text AS kind,
    e.location,
    e.location_h3_r5, e.location_h3_r7, e.location_h3_r9, e.location_h3_r10,
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
    l.location_h3_r5, l.location_h3_r7, l.location_h3_r9, l.location_h3_r10,
    l.visibility,
    jsonb_build_object(
      'title',         l.title,
      'thumbnailUrl',  l.thumbnail_url,
      'priceCents',    l.price_cents,
      'currency',      l.currency,
      'category',      l.category
    ) AS meta
  FROM listings l
  WHERE l.deleted_at IS NULL AND l.status = 'active';

-- If query latency on this view becomes a problem at scale, swap to a
-- MATERIALIZED VIEW + trigger-driven REFRESH for the user/event/listing tables.
-- Keep it as a plain view until measurements force the change.
