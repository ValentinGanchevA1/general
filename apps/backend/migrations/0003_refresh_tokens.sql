CREATE TABLE IF NOT EXISTS refresh_tokens (
  id          UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     UUID        NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  -- SHA-256(opaque_token) — never store the raw token
  token_hash  TEXT        NOT NULL UNIQUE,
  -- All tokens issued from one login chain share a family UUID.
  -- If a revoked token is presented we revoke the entire family (theft detection).
  family      UUID        NOT NULL,
  expires_at  TIMESTAMPTZ NOT NULL,
  revoked_at  TIMESTAMPTZ,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_refresh_tokens_user_id ON refresh_tokens(user_id);
CREATE INDEX IF NOT EXISTS idx_refresh_tokens_family  ON refresh_tokens(family);
