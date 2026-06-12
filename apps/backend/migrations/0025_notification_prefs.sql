-- 0025_notification_prefs.sql — P3.3 per-channel push opt-out.
--
-- Push channels (waves · messages · gifts · nearby · events · listings · digest)
-- are opt-IN by default. A row here records an explicit opt-OUT (enabled=false);
-- absence of a row means the channel is on. The app overlays these rows onto the
-- full channel list (see @g88/shared NOTIFICATION_CHANNELS) when reading prefs,
-- and skips a push when allowed() finds enabled=false. Frequency caps are tracked
-- in Redis, not here.
--
-- Idempotent (guarded DDL) — safe to re-run.

CREATE TABLE IF NOT EXISTS notification_preferences (
  user_id    uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  channel    text NOT NULL,
  enabled    boolean NOT NULL DEFAULT true,
  updated_at timestamptz NOT NULL DEFAULT NOW(),
  PRIMARY KEY (user_id, channel)
);

CREATE INDEX IF NOT EXISTS notification_preferences_user_idx ON notification_preferences (user_id);
