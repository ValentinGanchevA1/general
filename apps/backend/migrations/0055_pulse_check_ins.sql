-- 0055_pulse_check_ins.sql
-- Explicit, short-lived Pulse check-ins.
-- Privacy invariant: exact coordinates are never persisted. The API accepts a
-- coordinate only to derive the coarse H3 r7 cell stored below.

CREATE TABLE IF NOT EXISTS pulse_check_ins (
  id              uuid PRIMARY KEY,
  user_id         uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  place_label     text NOT NULL,
  audience        text NOT NULL CHECK (audience IN ('friends', 'nearby')),
  location_h3_r7  text NOT NULL,
  created_at      timestamptz NOT NULL,
  expires_at      timestamptz NOT NULL,
  deleted_at      timestamptz,
  CHECK (char_length(place_label) BETWEEN 2 AND 80),
  CHECK (expires_at > created_at)
);

CREATE INDEX IF NOT EXISTS pulse_check_ins_user_recent_idx
  ON pulse_check_ins (user_id, created_at DESC)
  WHERE deleted_at IS NULL;

CREATE INDEX IF NOT EXISTS pulse_check_ins_cell_active_idx
  ON pulse_check_ins (location_h3_r7, created_at DESC)
  WHERE deleted_at IS NULL;
