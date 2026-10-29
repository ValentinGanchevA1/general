-- 0065_notification_frequency_caps.sql
-- Restart-survivable notification frequency caps.
-- Stores only durable user/channel abuse-control metadata; no notification body,
-- device token, message content, or location data is persisted here.

CREATE TABLE IF NOT EXISTS notification_frequency_caps (
  user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  channel text NOT NULL,
  window_bucket bigint NOT NULL,
  send_count integer NOT NULL CHECK (send_count >= 1),
  expires_at timestamptz NOT NULL,
  updated_at timestamptz NOT NULL DEFAULT NOW(),
  PRIMARY KEY (user_id, channel, window_bucket),
  CONSTRAINT notification_frequency_caps_channel_check
    CHECK (channel IN ('waves', 'messages', 'gifts', 'friends', 'nearby', 'events', 'listings', 'digest'))
);

CREATE INDEX IF NOT EXISTS notification_frequency_caps_expires_at_idx
  ON notification_frequency_caps (expires_at);

COMMENT ON TABLE notification_frequency_caps IS
  'Short-retention shared abuse-control counters for push notification frequency caps.';
