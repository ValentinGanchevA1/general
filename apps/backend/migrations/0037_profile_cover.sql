-- Independent profile cover (background) photo — separate from avatar / gallery primary.
ALTER TABLE users
  ADD COLUMN IF NOT EXISTS cover_url text;

COMMENT ON COLUMN users.cover_url IS
  'Optional full-bleed cover/background image URL (gallery or direct upload). Independent of avatar_url.';
