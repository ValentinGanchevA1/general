-- 0059_nexa_places_catalog.sql
-- Durable NEXA-owned place identities backed by coarse location + external refs.
-- Exact venue coordinates are intentionally not persisted.

CREATE TABLE IF NOT EXISTS nexa_places (
  id                   uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  canonical_label      text NOT NULL,
  location_h3_r7       text NOT NULL,
  status               text NOT NULL DEFAULT 'active'
                       CHECK (status IN ('active', 'merged')),
  merged_into_place_id uuid REFERENCES nexa_places(id) ON DELETE RESTRICT,
  last_seen_at         timestamptz NOT NULL DEFAULT NOW(),
  created_at           timestamptz NOT NULL DEFAULT NOW(),
  updated_at           timestamptz NOT NULL DEFAULT NOW(),
  CHECK (
    (status = 'active' AND merged_into_place_id IS NULL)
    OR
    (status = 'merged' AND merged_into_place_id IS NOT NULL)
  )
);

CREATE TABLE IF NOT EXISTS nexa_place_external_refs (
  place_id     uuid NOT NULL REFERENCES nexa_places(id) ON DELETE CASCADE,
  namespace    text NOT NULL,
  external_id  text NOT NULL,
  last_seen_at timestamptz NOT NULL DEFAULT NOW(),
  created_at   timestamptz NOT NULL DEFAULT NOW(),
  PRIMARY KEY (namespace, external_id)
);

CREATE INDEX IF NOT EXISTS nexa_places_h3_idx
  ON nexa_places (location_h3_r7, last_seen_at DESC)
  WHERE status = 'active';

CREATE INDEX IF NOT EXISTS nexa_place_external_refs_place_idx
  ON nexa_place_external_refs (place_id, namespace);

ALTER TABLE pulse_check_ins
  ADD COLUMN IF NOT EXISTS place_id uuid REFERENCES nexa_places(id) ON DELETE SET NULL;

ALTER TABLE pulse_place_trends
  ADD COLUMN IF NOT EXISTS place_id uuid REFERENCES nexa_places(id) ON DELETE SET NULL;

-- Do not carry pre-catalog provider-key aggregates across the trust boundary.
UPDATE pulse_place_trends
   SET expires_at = LEAST(expires_at, NOW()),
       updated_at = NOW()
 WHERE place_id IS NULL;

-- Rolling deploy hard gate: older application instances may still attempt
-- provider-key trends. They can fail only the best-effort trend emission;
-- check-in persistence remains valid.
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'pulse_place_trends_place_id_required'
  ) THEN
    ALTER TABLE pulse_place_trends
      ADD CONSTRAINT pulse_place_trends_place_id_required
      CHECK (place_id IS NOT NULL) NOT VALID;
  END IF;
END;
$$;

CREATE INDEX IF NOT EXISTS pulse_check_ins_place_id_idx
  ON pulse_check_ins (place_id, created_at DESC)
  WHERE place_id IS NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS pulse_place_trends_place_id_unique_idx
  ON pulse_place_trends (place_id)
  WHERE place_id IS NOT NULL;
