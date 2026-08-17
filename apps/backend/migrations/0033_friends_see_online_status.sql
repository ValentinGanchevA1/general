-- Close-friend online visibility (independent of map presence / show on map).
-- Default true: friends can see when you are online unless you opt out.

ALTER TABLE users
  ADD COLUMN IF NOT EXISTS friends_see_online_status boolean NOT NULL DEFAULT true;

COMMENT ON COLUMN users.friends_see_online_status IS
  'When false, close friends cannot see this user as online (list, WS friend:presence, chat sort).';
