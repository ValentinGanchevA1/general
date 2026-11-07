-- Authenticated user/story abuse reports; no raw UGC, location, or PII snapshots.
-- 0069 is reserved by the in-flight room revocation migration.
CREATE TABLE IF NOT EXISTS content_abuse_reports (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  reporter_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  target_type text NOT NULL CHECK (target_type IN ('user','story')),
  target_id uuid NOT NULL,
  reason text NOT NULL CHECK (reason IN ('spam','harassment','hate','sexual','violence','privacy','other')),
  status text NOT NULL DEFAULT 'open' CHECK (status IN ('open','reviewed','dismissed','hidden')),
  created_at timestamptz NOT NULL DEFAULT clock_timestamp(),
  reviewed_at timestamptz,
  reviewed_by uuid REFERENCES users(id) ON DELETE SET NULL,
  review_note text CHECK (char_length(review_note) <= 500),
  UNIQUE (reporter_id, target_type, target_id)
);
CREATE INDEX IF NOT EXISTS content_abuse_reports_queue_idx
  ON content_abuse_reports (status, created_at DESC, id DESC);
