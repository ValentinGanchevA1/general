-- Confirmed attendance is separate from RSVP. No personal location is collected.
CREATE TABLE event_attendance_confirmations (
  event_id uuid NOT NULL,
  user_id uuid NOT NULL,
  confirmed_at timestamptz NOT NULL DEFAULT statement_timestamp(),
  confirmed_by uuid REFERENCES users(id) ON DELETE SET NULL,
  PRIMARY KEY (event_id, user_id),
  FOREIGN KEY (event_id, user_id) REFERENCES event_attendees(event_id, user_id) ON DELETE CASCADE
);
CREATE TABLE event_reviews (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id uuid NOT NULL REFERENCES events(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  rating smallint NOT NULL CHECK (rating BETWEEN 1 AND 5),
  tags text[] NOT NULL DEFAULT '{}',
  comment text NOT NULL DEFAULT '' CHECK (char_length(comment) <= 500),
  created_at timestamptz NOT NULL DEFAULT statement_timestamp(),
  updated_at timestamptz NOT NULL DEFAULT statement_timestamp(),
  editable_until timestamptz NOT NULL DEFAULT (statement_timestamp() + interval '24 hours'),
  hidden_at timestamptz,
  UNIQUE (event_id, user_id),
  CHECK (editable_until = created_at + interval '24 hours'),
  CHECK (cardinality(tags) <= 3 AND array_position(tags, NULL) IS NULL AND
    tags <@ ARRAY['welcoming','well_organized','great_venue','good_value','could_improve']::text[])
);
CREATE INDEX event_reviews_page_idx ON event_reviews(event_id, id) WHERE hidden_at IS NULL;
CREATE FUNCTION enforce_event_review_update() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF TG_OP = 'UPDATE' AND (NEW.id <> OLD.id OR NEW.created_at <> OLD.created_at OR NEW.editable_until <> OLD.editable_until OR
     NEW.event_id <> OLD.event_id OR NEW.user_id <> OLD.user_id) THEN
    RAISE EXCEPTION 'review identity and deadline are immutable' USING ERRCODE = '23514';
  END IF;
  IF TG_OP = 'UPDATE' AND (NEW.rating, NEW.tags, NEW.comment) IS DISTINCT FROM (OLD.rating, OLD.tags, OLD.comment)
     AND clock_timestamp() >= OLD.editable_until THEN
    RAISE EXCEPTION 'review edit window closed' USING ERRCODE = 'P0409';
  END IF;
  IF cardinality(NEW.tags) <> (SELECT count(DISTINCT t) FROM unnest(NEW.tags) t) THEN
    RAISE EXCEPTION 'review tags must be unique' USING ERRCODE = '23514';
  END IF;
  RETURN NEW;
END $$;
CREATE TRIGGER event_review_write BEFORE INSERT OR UPDATE ON event_reviews
  FOR EACH ROW EXECUTE FUNCTION enforce_event_review_update();
CREATE TABLE event_review_reports (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  review_id uuid NOT NULL REFERENCES event_reviews(id) ON DELETE CASCADE,
  reporter_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  reason text NOT NULL CHECK (reason IN ('abuse','spam','privacy','attendance_dispute')),
  created_at timestamptz NOT NULL DEFAULT statement_timestamp(),
  UNIQUE (review_id, reporter_id)
);
CREATE INDEX event_review_reports_queue_idx ON event_review_reports(created_at, id);
