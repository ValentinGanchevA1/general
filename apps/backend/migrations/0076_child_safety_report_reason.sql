-- P0 safety reporting: distinguish suspected child exploitation from ordinary sexual
-- content and present these reports first in the operator queue.
-- Contains NO media or message snapshots and grants NO extra admin access.
-- Apply after 0070 and 0073; never run directly against production without a
-- staged schema/rollback review and an active safety incident process.
ALTER TABLE content_abuse_reports
  DROP CONSTRAINT IF EXISTS content_abuse_reports_reason_check;

ALTER TABLE content_abuse_reports
  ADD CONSTRAINT content_abuse_reports_reason_check
  CHECK (reason IN ('child_safety', 'spam', 'harassment', 'hate', 'sexual',
                   'violence', 'privacy', 'other'));

CREATE INDEX IF NOT EXISTS content_abuse_reports_priority_queue_idx
  ON content_abuse_reports (
    status,
    (CASE WHEN reason = 'child_safety' THEN 0 ELSE 1 END),
    created_at DESC,
    id DESC
  );
