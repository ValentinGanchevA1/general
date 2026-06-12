-- 0022_events.sql — P3.5 Events backend (RSVP, polls, Q&A).
--
-- The `events` table itself already exists from 0001_initial.sql (host, title,
-- time, location/H3, capacity, attendee_count) and already feeds
-- v_discoverable_entity, so "events near you" rides the existing discovery view.
-- This migration adds the surfaces the events epic needs on top of that table:
--   • event_attendees       — RSVP ledger; drives events.attendee_count.
--   • event_polls / options / votes — host-run live polls, one vote per user/poll.
--   • event_questions / upvotes     — attendee Q&A with dedup'd upvotes.
--
-- NOTE on privacy: unlike a user's tracked position (fuzzed to r10 — invariant
-- §3.3), an event's location is a host-PUBLISHED venue pin. It is stored
-- precisely and its H3 cells are app-computed (computeH3Cells) at write time,
-- consistent with how 0001 documents events.location_h3_* population.
--
-- Idempotent (guarded DDL) — safe to re-run.

-- ─── RSVP ───────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS event_attendees (
  event_id   uuid NOT NULL REFERENCES events(id) ON DELETE CASCADE,
  user_id    uuid NOT NULL REFERENCES users(id)  ON DELETE CASCADE,
  status     text NOT NULL DEFAULT 'going'
             CHECK (status IN ('going','maybe','declined')),
  created_at timestamptz NOT NULL DEFAULT NOW(),
  updated_at timestamptz NOT NULL DEFAULT NOW(),
  PRIMARY KEY (event_id, user_id)
);

CREATE INDEX IF NOT EXISTS event_attendees_user_idx  ON event_attendees (user_id);
CREATE INDEX IF NOT EXISTS event_attendees_event_idx ON event_attendees (event_id, status);

-- ─── Polls ──────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS event_polls (
  id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id   uuid NOT NULL REFERENCES events(id) ON DELETE CASCADE,
  question   text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT NOW(),
  closed_at  timestamptz
);

CREATE INDEX IF NOT EXISTS event_polls_event_idx ON event_polls (event_id);

CREATE TABLE IF NOT EXISTS event_poll_options (
  id       uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  poll_id  uuid NOT NULL REFERENCES event_polls(id) ON DELETE CASCADE,
  label    text NOT NULL,
  position integer NOT NULL DEFAULT 0
);

CREATE INDEX IF NOT EXISTS event_poll_options_poll_idx ON event_poll_options (poll_id, position);

-- One vote per user per poll (PK on poll_id+user_id); option_id records the choice.
CREATE TABLE IF NOT EXISTS event_poll_votes (
  poll_id    uuid NOT NULL REFERENCES event_polls(id)        ON DELETE CASCADE,
  option_id  uuid NOT NULL REFERENCES event_poll_options(id) ON DELETE CASCADE,
  user_id    uuid NOT NULL REFERENCES users(id)              ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT NOW(),
  PRIMARY KEY (poll_id, user_id)
);

CREATE INDEX IF NOT EXISTS event_poll_votes_option_idx ON event_poll_votes (option_id);

-- ─── Q&A ────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS event_questions (
  id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id   uuid NOT NULL REFERENCES events(id) ON DELETE CASCADE,
  user_id    uuid NOT NULL REFERENCES users(id)  ON DELETE CASCADE,
  body       text NOT NULL,
  upvotes    integer NOT NULL DEFAULT 0,
  answered   boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS event_questions_event_idx ON event_questions (event_id, upvotes DESC);

-- Dedup'd upvotes; presence of a row == this user upvoted. Count cached on the question.
CREATE TABLE IF NOT EXISTS event_question_upvotes (
  question_id uuid NOT NULL REFERENCES event_questions(id) ON DELETE CASCADE,
  user_id     uuid NOT NULL REFERENCES users(id)           ON DELETE CASCADE,
  created_at  timestamptz NOT NULL DEFAULT NOW(),
  PRIMARY KEY (question_id, user_id)
);
