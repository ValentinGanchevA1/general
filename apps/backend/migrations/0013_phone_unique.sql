-- 0013_phone_unique.sql — One account per verified phone (G2).
--
-- users.phone is only ever written by the phone-verification flow
-- (VerificationService.checkPhone), so a partial unique index is safe and
-- prevents two accounts from claiming the same number. The verification
-- service catches the unique-violation and returns 409 verification.phone_taken.

CREATE UNIQUE INDEX IF NOT EXISTS users_phone_unique
  ON users (phone)
  WHERE phone IS NOT NULL AND deleted_at IS NULL;
