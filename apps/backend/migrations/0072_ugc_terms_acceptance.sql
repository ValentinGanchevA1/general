-- Versioned, affirmative UGC Terms acceptance. Never record implied acceptance.
-- `users.id` is the principal; client cannot submit a user ID.
CREATE TABLE IF NOT EXISTS user_terms_acceptances (
  user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  terms_version varchar(64) NOT NULL,
  accepted_at timestamptz NOT NULL DEFAULT clock_timestamp(),
  channel text NOT NULL CHECK (channel IN ('mobile','web','api')),
  PRIMARY KEY (user_id, terms_version),
  CONSTRAINT user_terms_version_format CHECK (terms_version ~ '^[a-zA-Z0-9][a-zA-Z0-9._-]{1,63}$')
);
COMMENT ON TABLE user_terms_acceptances IS
 'Immutable versioned affirmative acceptance; never infer from login or link display';
