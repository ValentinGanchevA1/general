-- 0032_friends.sql — two-tier social graph (follows + close friends)
-- Follows: one-way, no approval.
-- Friend requests: request/accept flow; accept materializes friendships.
-- Friendships: ordered pair (user_low_id < user_high_id) to dedupe symmetric edges.
-- Block cascade (hard delete) is enforced in FriendsService.onBlock, called from BlocksService.

CREATE TABLE IF NOT EXISTS follows (
  follower_id  uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  followee_id  uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  created_at   timestamptz NOT NULL DEFAULT NOW(),
  PRIMARY KEY (follower_id, followee_id),
  CHECK (follower_id <> followee_id)
);

CREATE INDEX IF NOT EXISTS follows_followee_idx ON follows (followee_id);

CREATE TABLE IF NOT EXISTS friend_requests (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  requester_id  uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  addressee_id  uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  status        text NOT NULL DEFAULT 'pending'
                CHECK (status IN ('pending', 'accepted', 'declined', 'cancelled')),
  created_at    timestamptz NOT NULL DEFAULT NOW(),
  responded_at  timestamptz,
  CHECK (requester_id <> addressee_id)
);

-- At most one pending request per directed pair.
CREATE UNIQUE INDEX IF NOT EXISTS friend_requests_pending_unique
  ON friend_requests (requester_id, addressee_id)
  WHERE status = 'pending';

CREATE INDEX IF NOT EXISTS friend_requests_addressee_pending_idx
  ON friend_requests (addressee_id)
  WHERE status = 'pending';

CREATE TABLE IF NOT EXISTS friendships (
  user_low_id   uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  user_high_id  uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  created_at    timestamptz NOT NULL DEFAULT NOW(),
  PRIMARY KEY (user_low_id, user_high_id),
  CHECK (user_low_id < user_high_id)
);

CREATE INDEX IF NOT EXISTS friendships_high_idx ON friendships (user_high_id);
