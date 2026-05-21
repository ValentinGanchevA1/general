-- 0005_h3_not_null_backfill.sql
-- Enforce H3 cell completeness and add missing indexes.
--
-- Context: H3 cells are populated by app code (computeH3Cells() from @g88/shared)
-- before every INSERT/UPDATE that sets `location`. This migration enforces that
-- invariant at the DB level and covers the resolutions that were absent from 0001.
--
-- Backfill: events/listings have no production rows yet (Phase 1). users rows that
-- have a non-null location will be backfilled by the next presence:update heartbeat
-- (the presence service now flushes to Postgres on cell change). If you need an
-- immediate backfill of existing user rows, run the Node script at
-- scripts/backfill-h3-cells.ts before promoting this migration to production.

-- ─── users: conditional constraint ───────────────────────────────────────────
-- location is nullable for users; enforce that H3 cells are always populated
-- together with location.

ALTER TABLE users
  ADD CONSTRAINT users_h3_location_sync CHECK (
    location IS NULL OR (
      location_h3_r4  IS NOT NULL AND
      location_h3_r5  IS NOT NULL AND
      location_h3_r6  IS NOT NULL AND
      location_h3_r7  IS NOT NULL AND
      location_h3_r8  IS NOT NULL AND
      location_h3_r9  IS NOT NULL AND
      location_h3_r10 IS NOT NULL
    )
  );

-- ─── events: location NOT NULL → H3 columns must always be non-null ──────────
ALTER TABLE events
  ALTER COLUMN location_h3_r4  SET NOT NULL,
  ALTER COLUMN location_h3_r5  SET NOT NULL,
  ALTER COLUMN location_h3_r6  SET NOT NULL,
  ALTER COLUMN location_h3_r7  SET NOT NULL,
  ALTER COLUMN location_h3_r8  SET NOT NULL,
  ALTER COLUMN location_h3_r9  SET NOT NULL,
  ALTER COLUMN location_h3_r10 SET NOT NULL;

-- ─── listings: same ───────────────────────────────────────────────────────────
ALTER TABLE listings
  ALTER COLUMN location_h3_r4  SET NOT NULL,
  ALTER COLUMN location_h3_r5  SET NOT NULL,
  ALTER COLUMN location_h3_r6  SET NOT NULL,
  ALTER COLUMN location_h3_r7  SET NOT NULL,
  ALTER COLUMN location_h3_r8  SET NOT NULL,
  ALTER COLUMN location_h3_r9  SET NOT NULL,
  ALTER COLUMN location_h3_r10 SET NOT NULL;

-- ─── Missing indexes ──────────────────────────────────────────────────────────
-- 0001_initial.sql only indexed r5/r7/r9/r10 on users and r7/r9 on events/listings.
-- Add the missing r4/r6/r8 for cluster queries at low/mid zoom.

CREATE INDEX IF NOT EXISTS users_h3_r4_idx ON users (location_h3_r4);
CREATE INDEX IF NOT EXISTS users_h3_r6_idx ON users (location_h3_r6);
CREATE INDEX IF NOT EXISTS users_h3_r8_idx ON users (location_h3_r8);

CREATE INDEX IF NOT EXISTS events_h3_r4_idx  ON events (location_h3_r4);
CREATE INDEX IF NOT EXISTS events_h3_r5_idx  ON events (location_h3_r5);
CREATE INDEX IF NOT EXISTS events_h3_r6_idx  ON events (location_h3_r6);
CREATE INDEX IF NOT EXISTS events_h3_r8_idx  ON events (location_h3_r8);
CREATE INDEX IF NOT EXISTS events_h3_r10_idx ON events (location_h3_r10);

CREATE INDEX IF NOT EXISTS listings_h3_r4_idx  ON listings (location_h3_r4);
CREATE INDEX IF NOT EXISTS listings_h3_r5_idx  ON listings (location_h3_r5);
CREATE INDEX IF NOT EXISTS listings_h3_r6_idx  ON listings (location_h3_r6);
CREATE INDEX IF NOT EXISTS listings_h3_r8_idx  ON listings (location_h3_r8);
CREATE INDEX IF NOT EXISTS listings_h3_r10_idx ON listings (location_h3_r10);