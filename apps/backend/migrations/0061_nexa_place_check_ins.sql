-- 0061_nexa_place_check_ins.sql
-- NEXA-owned place IDs are the authoritative trend identity.
-- Provider aliases are optional legacy metadata and must not be required for
-- check-ins initiated directly from a canonical NEXA place entity.

ALTER TABLE pulse_place_trends
  DROP CONSTRAINT IF EXISTS pulse_place_trends_provider_required;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'pulse_place_trends_provider_all_or_none'
  ) THEN
    ALTER TABLE pulse_place_trends
      ADD CONSTRAINT pulse_place_trends_provider_all_or_none
      CHECK (
        (place_provider IS NULL AND place_provider_id IS NULL)
        OR
        (place_provider IS NOT NULL AND place_provider_id IS NOT NULL)
      ) NOT VALID;
  END IF;
END;
$$;
