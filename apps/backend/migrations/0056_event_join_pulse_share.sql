-- 0056_event_join_pulse_share.sql
-- Explicit consent marker for publishing an event RSVP into Pulse.
-- RSVP itself does not imply Pulse visibility; only pulse_shared_at does.

ALTER TABLE event_attendees
  ADD COLUMN IF NOT EXISTS pulse_shared_at timestamptz;

CREATE INDEX IF NOT EXISTS event_attendees_pulse_shared_idx
  ON event_attendees (pulse_shared_at DESC)
  WHERE status = 'going' AND pulse_shared_at IS NOT NULL;

CREATE OR REPLACE FUNCTION clear_event_attendee_pulse_share_on_non_going()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  IF NEW.status <> 'going' THEN
    NEW.pulse_shared_at := NULL;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS event_attendees_clear_pulse_share ON event_attendees;
CREATE TRIGGER event_attendees_clear_pulse_share
BEFORE INSERT OR UPDATE OF status ON event_attendees
FOR EACH ROW
EXECUTE FUNCTION clear_event_attendee_pulse_share_on_non_going();
