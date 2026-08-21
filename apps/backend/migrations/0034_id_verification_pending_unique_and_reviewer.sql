-- 0034_id_verification_pending_unique_and_reviewer.sql
-- 1) One open pending verification per user (matches requireEligible app gate).
-- 2) Drop legacy reviewer_id from 0020; reviewed_by (0027) is the only reviewer column.

-- Collapse duplicate pending rows: keep the latest per user, mark older as rejected.
WITH ranked AS (
  SELECT id,
         ROW_NUMBER() OVER (PARTITION BY user_id ORDER BY created_at DESC) AS rn
  FROM user_id_verifications
  WHERE status = 'pending'
)
UPDATE user_id_verifications u
SET status = 'rejected',
    rejection_reason = COALESCE(u.rejection_reason, 'Superseded by newer submission'),
    reviewed_at = COALESCE(u.reviewed_at, now())
FROM ranked r
WHERE u.id = r.id AND r.rn > 1;

CREATE UNIQUE INDEX IF NOT EXISTS uq_user_id_verifications_one_pending
  ON user_id_verifications (user_id)
  WHERE status = 'pending';

-- Align reviewer column: 0020 introduced reviewer_id; 0027 added reviewed_by.
-- Prefer reviewed_by; backfill from reviewer_id if present, then drop reviewer_id.
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'user_id_verifications' AND column_name = 'reviewer_id'
  ) AND EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'user_id_verifications' AND column_name = 'reviewed_by'
  ) THEN
    UPDATE user_id_verifications
    SET reviewed_by = reviewer_id
    WHERE reviewed_by IS NULL AND reviewer_id IS NOT NULL;

    ALTER TABLE user_id_verifications DROP COLUMN reviewer_id;
  ELSIF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'user_id_verifications' AND column_name = 'reviewer_id'
  ) AND NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'user_id_verifications' AND column_name = 'reviewed_by'
  ) THEN
    ALTER TABLE user_id_verifications RENAME COLUMN reviewer_id TO reviewed_by;
  END IF;
END $$;
