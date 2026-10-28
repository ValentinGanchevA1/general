-- 0056_event_join_pulse_share.sql
-- Explicit consent marker for publishing an event RSVP into Pulse.
-- RSVP itself does not imply Pulse visibility; only pulse_shared_at does.

ALTER TABLE event_attendees
  ADD COLUMN IF NOT EXISTS pulse_shared_at timestamptz;

CREATE INDEX IF NOT EXISTS event_attendees_pulse_shared_idx
  ON event_attendees (pulse_shared_at DESC)
  WHERE status = 'going' AND pulse_shared_at IS NOT NULL;
