-- 0007_alerts.sql — Alerts table (Nextdoor-style area posts)
-- Location is copied from the author's last known fuzzed position at write time.

CREATE TABLE IF NOT EXISTS alerts (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  author_id       uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  category        text NOT NULL
                  CHECK (category IN ('general','food','events','help','business','news')),
  body            text NOT NULL
                  CHECK (char_length(body) BETWEEN 1 AND 280),
  tag             text
                  CHECK (tag IS NULL OR char_length(tag) BETWEEN 1 AND 60),

  -- Copied from users.location at insert time (already fuzzed to r10 centroid).
  location        geography(Point, 4326),
  location_h3_r7  text,
  location_h3_r8  text,

  visibility      text NOT NULL DEFAULT 'public'
                  CHECK (visibility IN ('public', 'private')),

  created_at      timestamptz NOT NULL DEFAULT NOW(),
  deleted_at      timestamptz
);

CREATE INDEX IF NOT EXISTS alerts_h3_r7_idx   ON alerts (location_h3_r7)  WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS alerts_created_idx ON alerts (created_at DESC)  WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS alerts_author_idx  ON alerts (author_id)        WHERE deleted_at IS NULL;
