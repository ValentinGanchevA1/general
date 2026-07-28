-- 0028_id_verification_rekognition.sql
-- Assist-only face match scores for admin review (human still decides).

ALTER TABLE user_id_verifications
  ADD COLUMN IF NOT EXISTS face_similarity real,
  ADD COLUMN IF NOT EXISTS selfie_face_count smallint,
  ADD COLUMN IF NOT EXISTS id_front_face_count smallint,
  ADD COLUMN IF NOT EXISTS selfie_face_confidence real,
  ADD COLUMN IF NOT EXISTS id_front_face_confidence real,
  ADD COLUMN IF NOT EXISTS rekognition_status text NOT NULL DEFAULT 'skipped',
  ADD COLUMN IF NOT EXISTS rekognition_error text,
  ADD COLUMN IF NOT EXISTS rekognition_at timestamptz;
