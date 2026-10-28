CREATE TABLE IF NOT EXISTS analytics_external_deletion_requests (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  provider text NOT NULL CHECK (provider = 'posthog'),
  kind text NOT NULL CHECK (kind IN ('subject', 'retention')),
  subject_hash char(64),
  cutoff_at timestamptz,
  status text NOT NULL DEFAULT 'queued'
    CHECK (status IN ('queued', 'submitted', 'completed', 'failed')),
  submission_id uuid NOT NULL DEFAULT gen_random_uuid(),
  provider_request_id uuid,
  attempts integer NOT NULL DEFAULT 0 CHECK (attempts >= 0),
  next_attempt_at timestamptz NOT NULL DEFAULT NOW(),
  last_error text,
  created_at timestamptz NOT NULL DEFAULT NOW(),
  updated_at timestamptz NOT NULL DEFAULT NOW(),
  submitted_at timestamptz,
  completed_at timestamptz,
  CHECK (
    (kind = 'subject' AND subject_hash IS NOT NULL AND cutoff_at IS NULL)
    OR
    (kind = 'retention' AND subject_hash IS NULL AND cutoff_at IS NOT NULL)
  )
);

CREATE INDEX IF NOT EXISTS analytics_external_deletion_due_idx
  ON analytics_external_deletion_requests(next_attempt_at, created_at)
  WHERE status IN ('queued', 'failed');

CREATE INDEX IF NOT EXISTS analytics_external_deletion_submitted_idx
  ON analytics_external_deletion_requests(updated_at)
  WHERE status = 'submitted';

CREATE UNIQUE INDEX IF NOT EXISTS analytics_external_deletion_subject_active_uidx
  ON analytics_external_deletion_requests(provider, subject_hash)
  WHERE kind = 'subject' AND status IN ('queued', 'submitted', 'failed');

CREATE UNIQUE INDEX IF NOT EXISTS analytics_external_deletion_retention_active_uidx
  ON analytics_external_deletion_requests(provider, kind)
  WHERE kind = 'retention' AND status IN ('queued', 'submitted', 'failed');

-- Preserve the pseudonymous PostHog deletion handle before the local mapping is
-- removed. This also covers ON DELETE CASCADE from DELETE /users/me and the
-- first-party retention sweep, without coupling account deletion to an external API.
CREATE OR REPLACE FUNCTION queue_posthog_subject_deletion()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  INSERT INTO analytics_external_deletion_requests (provider, kind, subject_hash)
  VALUES ('posthog', 'subject', OLD.subject_hash)
  ON CONFLICT DO NOTHING;
  RETURN OLD;
END;
$$;

DROP TRIGGER IF EXISTS analytics_subjects_queue_posthog_delete ON analytics_subjects;
CREATE TRIGGER analytics_subjects_queue_posthog_delete
BEFORE DELETE ON analytics_subjects
FOR EACH ROW
EXECUTE FUNCTION queue_posthog_subject_deletion();
