-- 0020_id_verification.sql
CREATE TYPE id_verification_status AS ENUM ('none', 'pending', 'verified', 'rejected');

ALTER TABLE users
  ADD COLUMN id_verification_status id_verification_status NOT NULL DEFAULT 'none',
  ADD COLUMN id_verified_at timestamptz;

CREATE TABLE user_id_verifications (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  selfie_url text NOT NULL,
  id_front_url text NOT NULL,
  id_back_url text,
  status id_verification_status NOT NULL DEFAULT 'pending',
  reviewed_at timestamptz,
  reviewer_id uuid,
  rejection_reason text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_user_id_verifications_user_id ON user_id_verifications(user_id);
CREATE INDEX idx_user_id_verifications_status ON user_id_verifications(status);

