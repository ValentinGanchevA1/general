-- 0049_personal_activity_notifications.sql
-- Durable in-app personal activity signals that do not already have a
-- canonical Interactions domain record (wave, match, gift, friend request).
-- Push delivery/preferences are intentionally independent from this table.

CREATE TABLE IF NOT EXISTS personal_activity_notifications (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  recipient_id  uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  actor_id      uuid REFERENCES users(id) ON DELETE CASCADE,
  kind          text NOT NULL,
  source_type   text NOT NULL,
  source_id     text NOT NULL,
  destination  jsonb NOT NULL DEFAULT '{"type":"profile"}'::jsonb,
  created_at    timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT personal_activity_notifications_kind_chk
    CHECK (kind IN ('friend_accepted', 'mention')),
  CONSTRAINT personal_activity_notifications_destination_chk
    CHECK (jsonb_typeof(destination) = 'object'),
  CONSTRAINT personal_activity_notifications_source_unique
    UNIQUE (recipient_id, source_type, source_id)
);

CREATE INDEX IF NOT EXISTS personal_activity_notifications_recipient_created_idx
  ON personal_activity_notifications (recipient_id, created_at DESC);

CREATE INDEX IF NOT EXISTS personal_activity_notifications_actor_idx
  ON personal_activity_notifications (actor_id)
  WHERE actor_id IS NOT NULL;
