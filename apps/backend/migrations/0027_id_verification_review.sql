ALTER TABLE user_id_verifications
  ADD COLUMN IF NOT EXISTS reviewed_by uuid REFERENCES users(id),
  ADD COLUMN IF NOT EXISTS reviewed_at timestamptz,
  ADD COLUMN IF NOT EXISTS rejection_reason text;

CREATE INDEX IF NOT EXISTS idx_user_id_verifications_status
  ON user_id_verifications (status)
  WHERE status = 'pending';
