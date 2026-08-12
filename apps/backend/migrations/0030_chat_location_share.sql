-- 0030_chat_location_share.sql
-- Timed live location sessions inside 1:1 chat.
-- See docs/SPEC_CHAT_LIVE_LOCATION.md

-- Message type + optional location payload / session link
ALTER TABLE messages
  ADD COLUMN IF NOT EXISTS type text NOT NULL DEFAULT 'text',
  ADD COLUMN IF NOT EXISTS location jsonb,
  ADD COLUMN IF NOT EXISTS location_session_id uuid;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'messages_type_check'
  ) THEN
    ALTER TABLE messages
      ADD CONSTRAINT messages_type_check
      CHECK (type IN ('text', 'location', 'location_session'));
  END IF;
END $$;

CREATE TABLE IF NOT EXISTS chat_location_sessions (
  id                uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  conversation_id   uuid NOT NULL REFERENCES conversations(id) ON DELETE CASCADE,
  sharer_id         uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  status            text NOT NULL DEFAULT 'active'
                      CHECK (status IN ('active', 'ended')),
  duration          text NOT NULL
                      CHECK (duration IN ('15m', '60m', 'until_off')),
  started_at        timestamptz NOT NULL DEFAULT NOW(),
  ends_at           timestamptz,
  last_lat          double precision NOT NULL,
  last_lng          double precision NOT NULL,
  last_updated_at   timestamptz NOT NULL DEFAULT NOW(),
  ended_at          timestamptz,
  end_reason        text
                      CHECK (
                        end_reason IS NULL OR end_reason IN (
                          'expired', 'stopped', 'timeout', 'blocked', 'conversation_closed'
                        )
                      ),
  created_at        timestamptz NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS chat_location_sessions_conv_active_idx
  ON chat_location_sessions (conversation_id)
  WHERE status = 'active';

CREATE INDEX IF NOT EXISTS chat_location_sessions_ends_at_idx
  ON chat_location_sessions (ends_at)
  WHERE status = 'active' AND ends_at IS NOT NULL;

CREATE INDEX IF NOT EXISTS chat_location_sessions_sharer_active_idx
  ON chat_location_sessions (sharer_id)
  WHERE status = 'active';

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'messages_location_session_fk'
  ) THEN
    ALTER TABLE messages
      ADD CONSTRAINT messages_location_session_fk
      FOREIGN KEY (location_session_id)
      REFERENCES chat_location_sessions(id)
      ON DELETE SET NULL;
  END IF;
END $$;
