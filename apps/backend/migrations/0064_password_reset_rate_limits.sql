-- 0064_password_reset_rate_limits.sql
-- Restart-survivable abuse-control state for password-reset request limiting.
-- Stores only an HMAC digest of the normalized email; reset codes and delivery
-- payloads remain in the existing password_reset_requests flow.

CREATE TABLE IF NOT EXISTS password_reset_rate_limits (
  subject_hash char(64) PRIMARY KEY,
  window_started_at timestamptz NOT NULL,
  request_count integer NOT NULL CHECK (request_count >= 1 AND request_count <= 5),
  cooldown_until timestamptz NOT NULL,
  updated_at timestamptz NOT NULL DEFAULT NOW(),
  CONSTRAINT password_reset_rate_limits_subject_hash_format
    CHECK (subject_hash ~ '^[0-9a-f]{64}$')
);

CREATE INDEX IF NOT EXISTS password_reset_rate_limits_updated_at_idx
  ON password_reset_rate_limits (updated_at);

COMMENT ON TABLE password_reset_rate_limits IS
  'Short-retention durable abuse-control counters for password-reset requests; subject_hash is an HMAC digest, never a raw email.';
