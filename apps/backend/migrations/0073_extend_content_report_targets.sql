-- Add first-class reports for the other UGC surfaces in Play RC1.
-- The target is an opaque UUID; ownership and access are checked in ContentReportsService.
-- Report records hold no message body, media, or precise location snapshots.
ALTER TABLE content_abuse_reports
  DROP CONSTRAINT IF EXISTS content_abuse_reports_target_type_check;

ALTER TABLE content_abuse_reports
  ADD CONSTRAINT content_abuse_reports_target_type_check
  CHECK (target_type IN ('user', 'story', 'listing', 'event', 'message', 'check_in', 'alert', 'event_question'));
