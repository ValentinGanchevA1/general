-- 0050_product_analytics.sql — first-party, privacy-safe product analytics.
--
-- Event rows never carry raw user IDs. Identity linkage is isolated in
-- analytics_subjects so analysts can query pseudonymous cohorts, while account
-- deletion remains enforceable through FK cascades.

CREATE TABLE IF NOT EXISTS analytics_subjects (
  user_id      UUID PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
  subject_hash CHAR(64) NOT NULL UNIQUE,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at   TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS analytics_events (
  id           BIGSERIAL PRIMARY KEY,
  subject_hash CHAR(64) NOT NULL REFERENCES analytics_subjects(subject_hash)
                 ON UPDATE CASCADE ON DELETE CASCADE,
  event_name   VARCHAR(64) NOT NULL CHECK (event_name IN (
    'app.session_started',
    'entity.opened',
    'interaction.wave_sent',
    'event.rsvp_confirmed',
    'marketplace.offer_sent',
    'connection.created',
    'chat.message_sent'
  )),
  properties   JSONB NOT NULL DEFAULT '{}'::jsonb,
  occurred_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  received_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS analytics_events_event_time_idx
  ON analytics_events (event_name, occurred_at DESC);

CREATE INDEX IF NOT EXISTS analytics_events_subject_time_idx
  ON analytics_events (subject_hash, occurred_at DESC);

CREATE INDEX IF NOT EXISTS analytics_events_received_at_idx
  ON analytics_events (received_at DESC);

COMMENT ON TABLE analytics_subjects IS
  'Restricted identity bridge for first-party analytics. Events reference only subject_hash.';
COMMENT ON TABLE analytics_events IS
  'Low-cardinality product events only; no coordinates, entity IDs, message text, prices, contact details, or verification media.';
