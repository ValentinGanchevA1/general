#!/usr/bin/env node
/**
 * Disposable PostGIS regression for migration 0071.
 * Never connect to production or shared DBs. Run only on CI's loopback
 * database named *_bench with explicit acknowledgement.
 */
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';
import pg from 'pg';

const databaseUrl = new URL(process.env.DATABASE_URL ?? 'postgresql://invalid.invalid/invalid');
assert.equal(process.env.DISCOVERY_FULL_SCHEMA_ACK_DISPOSABLE, 'YES', 'Explicit disposable DB acknowledgement required');
assert.equal(databaseUrl.protocol, 'postgresql:', 'PostgreSQL URL required');
assert.ok(['127.0.0.1', 'localhost', '::1', '[::1]'].includes(databaseUrl.hostname), 'Loopback PostgreSQL only');
assert.ok(databaseUrl.pathname.endsWith('_bench'), 'Database name must end with _bench');

const migrationFile = resolve(dirname(fileURLToPath(import.meta.url)), '../migrations/0071_coarsen_story_geography.sql');
const migration = readFileSync(migrationFile, 'utf8');
const client = new pg.Client({ connectionString: databaseUrl.toString() });

try {
  await client.connect();
  await client.query('BEGIN');
  // PostgreSQL TEMP schema shadows the real stories relation even in a
  // disposable DB; no application table is touched by this smoke.
  await client.query(`
    CREATE TEMP TABLE stories (
      id integer PRIMARY KEY,
      location geography(Point,4326),
      approx_lat double precision NOT NULL,
      approx_lng double precision NOT NULL
    );
    INSERT INTO stories(id,location,approx_lat,approx_lng) VALUES
      (1, ST_SetSRID(ST_MakePoint(27.934617,43.213576),4326)::geography,43.214,27.935),
      (2, ST_SetSRID(ST_MakePoint(27.936,43.215),4326)::geography,43.215,27.936);
  `);
  const first = await client.query(migration);
  assert.equal(first.rowCount, 1, 'Historical exact GPS row must be coarsened');
  const repeat = await client.query(migration);
  assert.equal(repeat.rowCount, 0, 'Re-applying migration must be idempotent');
  const { rows } = await client.query(`
    SELECT id, ST_Y(location::geometry) AS lat, ST_X(location::geometry) AS lng,
           approx_lat, approx_lng
      FROM stories ORDER BY id
  `);
  assert.equal(rows.length, 2);
  for (const row of rows) {
    assert.equal(row.lat, row.approx_lat, `Story ${row.id}: stored latitude must be coarsened`);
    assert.equal(row.lng, row.approx_lng, `Story ${row.id}: stored longitude must be coarsened`);
  }
  console.log('STORY_GEO_COARSENING_POSTGIS_SMOKE_OK');
} finally {
  try { await client.query('ROLLBACK'); } finally { await client.end(); }
}
