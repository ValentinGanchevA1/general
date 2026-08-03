-- 0029_stories.sql — P4.S 24h location-tagged ephemeral stories.
--
-- Stories are short photo/video posts auto-tagged to the author's location.
-- TTL = 24h from created_at. Visible to anyone whose viewport intersects the
-- story's H3 cells, subject to mutual blocks.
--
-- Exact (lat,lng) is stored for ranking / future features; public payloads
-- expose only the r10-fuzzed approximate point (privacy invariant).
--
-- Unique view receipts (story_views) and heart/wave reactions ship in v1.
-- Idempotent (guarded DDL).
--
-- Note: partial indexes must NOT use NOW() (not IMMUTABLE). Expiry is filtered
-- in application queries; stories_expires_idx supports the cleanup job.

-- --- Stories ---------------------------------------------------------------
CREATE TABLE IF NOT EXISTS stories (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  author_id       uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  media_url       text NOT NULL,
  media_type      text NOT NULL CHECK (media_type IN ('image', 'video')),
  caption         text,
  -- Exact write-time position (server-trusted; never returned as-is to clients).
  location        geography(Point, 4326) NOT NULL,
  location_h3_r4  text NOT NULL,
  location_h3_r5  text NOT NULL,
  location_h3_r6  text NOT NULL,
  location_h3_r7  text NOT NULL,
  location_h3_r8  text NOT NULL,
  location_h3_r9  text NOT NULL,
  location_h3_r10 text NOT NULL,
  -- Approximate public coords (centroid of r10 cell) — what clients render.
  approx_lat      double precision NOT NULL,
  approx_lng      double precision NOT NULL,
  expires_at      timestamptz NOT NULL,
  view_count      integer NOT NULL DEFAULT 0,
  reaction_count  integer NOT NULL DEFAULT 0,
  created_at      timestamptz NOT NULL DEFAULT NOW(),
  deleted_at      timestamptz
);

CREATE INDEX IF NOT EXISTS stories_author_idx
  ON stories (author_id) WHERE deleted_at IS NULL;

CREATE INDEX IF NOT EXISTS stories_expires_idx
  ON stories (expires_at) WHERE deleted_at IS NULL;

CREATE INDEX IF NOT EXISTS stories_location_gix
  ON stories USING GIST (location) WHERE deleted_at IS NULL;

-- H3 cell indexes for viewport nearby queries. Expiry filtered in SQL, not in
-- the predicate (NOW() is STABLE, not IMMUTABLE — Postgres rejects it here).
CREATE INDEX IF NOT EXISTS stories_h3_r7_idx
  ON stories (location_h3_r7) WHERE deleted_at IS NULL;

CREATE INDEX IF NOT EXISTS stories_h3_r8_idx
  ON stories (location_h3_r8) WHERE deleted_at IS NULL;

CREATE INDEX IF NOT EXISTS stories_h3_r9_idx
  ON stories (location_h3_r9) WHERE deleted_at IS NULL;

CREATE INDEX IF NOT EXISTS stories_h3_r10_idx
  ON stories (location_h3_r10) WHERE deleted_at IS NULL;

-- --- Unique view receipts --------------------------------------------------
CREATE TABLE IF NOT EXISTS story_views (
  story_id   uuid NOT NULL REFERENCES stories(id) ON DELETE CASCADE,
  viewer_id  uuid NOT NULL REFERENCES users(id)  ON DELETE CASCADE,
  viewed_at  timestamptz NOT NULL DEFAULT NOW(),
  PRIMARY KEY (story_id, viewer_id)
);

CREATE INDEX IF NOT EXISTS story_views_viewer_idx ON story_views (viewer_id);

-- --- Reactions (heart | wave) ----------------------------------------------
CREATE TABLE IF NOT EXISTS story_reactions (
  story_id    uuid NOT NULL REFERENCES stories(id) ON DELETE CASCADE,
  user_id     uuid NOT NULL REFERENCES users(id)  ON DELETE CASCADE,
  kind        text NOT NULL CHECK (kind IN ('heart', 'wave')),
  created_at  timestamptz NOT NULL DEFAULT NOW(),
  PRIMARY KEY (story_id, user_id)
);

CREATE INDEX IF NOT EXISTS story_reactions_user_idx ON story_reactions (user_id);
