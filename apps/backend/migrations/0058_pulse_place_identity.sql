-- 0058_pulse_place_identity.sql
-- Provider-backed place identity for check-ins/trends.
-- Exact venue coordinates are not persisted; only the provider feature id and coarse H3 r7 cell.

ALTER TABLE pulse_check_ins
  ADD COLUMN IF NOT EXISTS place_provider text,
  ADD COLUMN IF NOT EXISTS place_provider_id text,
  ADD COLUMN IF NOT EXISTS place_h3_r7 text;

ALTER TABLE pulse_place_trends
  ADD COLUMN IF NOT EXISTS place_provider text,
  ADD COLUMN IF NOT EXISTS place_provider_id text;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'pulse_check_ins_place_identity_all_or_none'
  ) THEN
    ALTER TABLE pulse_check_ins
      ADD CONSTRAINT pulse_check_ins_place_identity_all_or_none
      CHECK (
        (place_provider IS NULL AND place_provider_id IS NULL AND place_h3_r7 IS NULL)
        OR
        (place_provider IS NOT NULL AND place_provider_id IS NOT NULL AND place_h3_r7 IS NOT NULL)
      );
  END IF;
END;
$$;

CREATE INDEX IF NOT EXISTS pulse_check_ins_place_identity_idx
  ON pulse_check_ins (place_provider, place_provider_id, place_h3_r7, created_at DESC)
  WHERE place_provider IS NOT NULL AND place_provider_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS pulse_place_trends_provider_idx
  ON pulse_place_trends (place_provider, place_provider_id, last_emitted_at DESC)
  WHERE place_provider IS NOT NULL AND place_provider_id IS NOT NULL;
