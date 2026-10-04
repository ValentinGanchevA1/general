-- 0047_dating_likes
-- Dating like / pass / match storage (separate from social waves).
-- Mutual like opens a dedicated dating conversation (kind = dating) — app layer.

CREATE TABLE IF NOT EXISTS dating_likes (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  from_user_id    uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  to_user_id      uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  created_at      timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT dating_likes_no_self CHECK (from_user_id <> to_user_id),
  CONSTRAINT dating_likes_unique UNIQUE (from_user_id, to_user_id)
);

CREATE INDEX IF NOT EXISTS dating_likes_to_user_idx
  ON dating_likes (to_user_id, created_at DESC);

CREATE INDEX IF NOT EXISTS dating_likes_from_user_idx
  ON dating_likes (from_user_id, created_at DESC);

-- Passes: hide peer from dating discovery for viewer (soft, time-bounded optional later).
CREATE TABLE IF NOT EXISTS dating_passes (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  from_user_id    uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  to_user_id      uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  created_at      timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT dating_passes_no_self CHECK (from_user_id <> to_user_id),
  CONSTRAINT dating_passes_unique UNIQUE (from_user_id, to_user_id)
);

CREATE INDEX IF NOT EXISTS dating_passes_from_user_idx
  ON dating_passes (from_user_id);

-- Matches materialize when both sides have liked.
CREATE TABLE IF NOT EXISTS dating_matches (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_a_id       uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  user_b_id       uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  conversation_id uuid NULL,
  created_at      timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT dating_matches_ordered CHECK (user_a_id < user_b_id),
  CONSTRAINT dating_matches_unique UNIQUE (user_a_id, user_b_id)
);

CREATE INDEX IF NOT EXISTS dating_matches_user_a_idx ON dating_matches (user_a_id);
CREATE INDEX IF NOT EXISTS dating_matches_user_b_idx ON dating_matches (user_b_id);

COMMENT ON TABLE dating_likes IS 'One-way dating likes; mutual pair becomes dating_matches';
COMMENT ON TABLE dating_passes IS 'Viewer passed on peer in dating mode';
COMMENT ON TABLE dating_matches IS 'Mutual likes; conversation_id is dating-scoped thread';
