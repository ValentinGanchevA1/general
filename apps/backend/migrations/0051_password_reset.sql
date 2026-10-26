-- Password reset challenges are one-per-user and replaced on resend.
-- Never persist the raw code: HMAC verifies it, AES-GCM protects the mail outbox.
ALTER TABLE users ADD COLUMN IF NOT EXISTS auth_version integer NOT NULL DEFAULT 0;
ALTER TABLE refresh_tokens ADD COLUMN IF NOT EXISTS auth_version integer NOT NULL DEFAULT 0;

CREATE TABLE IF NOT EXISTS password_reset_requests (
  user_id uuid PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
  id uuid NOT NULL UNIQUE,
  code_hash text NOT NULL,
  attempts smallint NOT NULL DEFAULT 0 CHECK (attempts BETWEEN 0 AND 5),
  expires_at timestamptz NOT NULL,
  requested_at timestamptz NOT NULL DEFAULT NOW(),
  delivery_ciphertext text,
  delivery_attempts smallint NOT NULL DEFAULT 0 CHECK (delivery_attempts BETWEEN 0 AND 3),
  next_delivery_at timestamptz NOT NULL DEFAULT NOW(),
  delivery_claim uuid,
  delivery_lease_until timestamptz
);
CREATE INDEX IF NOT EXISTS password_reset_delivery_idx
  ON password_reset_requests(next_delivery_at)
  WHERE delivery_ciphertext IS NOT NULL AND delivery_attempts < 3;
