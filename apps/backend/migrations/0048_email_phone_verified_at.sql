-- Independent email / phone verification completion timestamps.
-- Trust checklist badges must not be inferred solely from verification_level ladder.
-- verification_level remains the progressive score/gate signal.

ALTER TABLE users
  ADD COLUMN IF NOT EXISTS email_verified_at timestamptz NULL,
  ADD COLUMN IF NOT EXISTS phone_verified_at timestamptz NULL;

-- Best-effort backfill from existing ladder so current users keep their badges.
UPDATE users
   SET email_verified_at = COALESCE(email_verified_at, updated_at, created_at)
 WHERE email_verified_at IS NULL
   AND verification_level IN ('email', 'phone', 'selfie', 'id');

UPDATE users
   SET phone_verified_at = COALESCE(phone_verified_at, updated_at, created_at)
 WHERE phone_verified_at IS NULL
   AND verification_level IN ('phone', 'selfie', 'id');
