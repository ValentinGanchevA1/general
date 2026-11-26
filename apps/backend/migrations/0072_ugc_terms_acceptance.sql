-- Store only the minimum evidence needed to enforce versioned Terms acceptance.
-- The server supplies accepted_at; IP addresses and user agents are not retained.
CREATE TABLE IF NOT EXISTS user_terms_acceptances (
  user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  terms_version text NOT NULL CHECK (char_length(terms_version) BETWEEN 1 AND 64),
  terms_sha256 text NOT NULL CHECK (terms_sha256 ~ '^[a-f0-9]{64}$'),
  accepted_at timestamptz NOT NULL DEFAULT NOW(),
  PRIMARY KEY (user_id, terms_version)
);
