-- 0060_nexa_place_saves.sql
-- Private per-user bookmarks for durable NEXA place identities.
-- No public save/follower counts are exposed from this table.

CREATE TABLE IF NOT EXISTS nexa_place_saves (
  user_id    uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  place_id   uuid NOT NULL REFERENCES nexa_places(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT NOW(),
  PRIMARY KEY (user_id, place_id)
);

CREATE INDEX IF NOT EXISTS nexa_place_saves_user_created_idx
  ON nexa_place_saves (user_id, created_at DESC);

CREATE INDEX IF NOT EXISTS nexa_places_merged_into_idx
  ON nexa_places (merged_into_place_id)
  WHERE status = 'merged' AND merged_into_place_id IS NOT NULL;
