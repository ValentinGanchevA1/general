-- 0008_geofences.sql — User-defined watched areas (geofences)
-- A geofence = an H3 r7 cell the user pins as a place they want to monitor.
-- center_h3_r7 + radius_rings define which cells are "inside" at query time
-- (computed in-process via h3.gridDisk rather than stored).

CREATE TABLE IF NOT EXISTS geofences (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id         uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,

  -- Human label: 'home', 'work', 'neighbourhood', etc.
  label           text NOT NULL DEFAULT 'home'
                  CHECK (char_length(label) BETWEEN 1 AND 50),

  -- Anchor cell — the H3 r7 cell this geofence is centred on.
  -- At r7 each cell is ~5 km² so radius_rings=1 covers ~35 km² (7 cells).
  center_h3_r7    text NOT NULL,

  -- How many rings of H3 r7 neighbors are included. 0 = single cell.
  radius_rings    integer NOT NULL DEFAULT 1
                  CHECK (radius_rings BETWEEN 0 AND 3),

  active          boolean NOT NULL DEFAULT true,

  created_at      timestamptz NOT NULL DEFAULT NOW(),
  updated_at      timestamptz NOT NULL DEFAULT NOW(),

  -- One geofence per anchor cell per user.
  UNIQUE (user_id, center_h3_r7)
);

CREATE INDEX IF NOT EXISTS geofences_user_active_idx ON geofences (user_id) WHERE active = true;
