-- 0057_pulse_place_trends.sql
-- Privacy-safe aggregate activity derived only from explicit Nearby check-ins.
-- Participant identities are never persisted in this table.

CREATE TABLE IF NOT EXISTS pulse_place_trends (
  id                  uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  place_key           text NOT NULL,
  place_label         text NOT NULL,
  location_h3_r7      text NOT NULL,
  distinct_user_count integer NOT NULL CHECK (distinct_user_count >= 5),
  last_emitted_at     timestamptz NOT NULL DEFAULT NOW(),
  expires_at          timestamptz NOT NULL,
  created_at          timestamptz NOT NULL DEFAULT NOW(),
  updated_at          timestamptz NOT NULL DEFAULT NOW(),
  UNIQUE (place_key, location_h3_r7)
);

CREATE INDEX IF NOT EXISTS pulse_place_trends_emitted_idx
  ON pulse_place_trends (last_emitted_at DESC, expires_at DESC);

CREATE INDEX IF NOT EXISTS pulse_place_trends_h3_idx
  ON pulse_place_trends (location_h3_r7, last_emitted_at DESC);
