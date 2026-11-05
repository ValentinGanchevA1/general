#!/usr/bin/env node
/**
 * Verify full NEXA migration coverage on a disposable localhost-only database.
 * The preflight mode must be called BEFORE running apps/backend/scripts/migrate.js.
 * Never inspect or mutate a production/staging database with this tool.
 */
import assert from 'node:assert/strict';
import { readdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import pg from 'pg';

const rawUrl = process.env.DATABASE_URL;
let databaseUrl;
try {
  databaseUrl = new URL(rawUrl ?? '');
} catch {
  throw new Error('A valid local DATABASE_URL is required');
}
assert.equal(process.env.DISCOVERY_FULL_SCHEMA_ACK_DISPOSABLE, 'YES',
  'Explicit DISCOVERY_FULL_SCHEMA_ACK_DISPOSABLE=YES required');
assert.ok(['localhost', '127.0.0.1', '::1'].includes(databaseUrl.hostname),
  'Full-schema smoke can only target loopback PostgreSQL');
assert.ok(databaseUrl.pathname.endsWith('_bench'),
  'The disposable PostgreSQL database name must end in _bench');
assert.equal(databaseUrl.protocol, 'postgresql:', 'Use postgresql:// for full-schema smoke');

if (process.argv.includes('--preflight')) {
  console.info('DISCOVERY_FULL_SCHEMA_PREFLIGHT_OK');
  process.exit(0);
}

const migrationsDir = join(dirname(fileURLToPath(import.meta.url)), '..', 'migrations');
const expected = readdirSync(migrationsDir).filter((name) => name.endsWith('.sql')).sort();
assert.ok(expected.length >= 60, 'Expected the complete NEXA migration set');

const client = new pg.Client({ connectionString: rawUrl });
try {
  await client.connect();

  const tracked = await client.query('SELECT filename FROM schema_migrations ORDER BY filename');
  const applied = tracked.rows.map((row) => row.filename);
  assert.deepEqual(applied, expected,
    'All migrations must be tracked exactly once, with no missing or unexpected filenames');

  const relationNames = [
    'users', 'events', 'listings', 'user_blocks', 'friendships',
    'conversations', 'conversation_members', 'v_discoverable_entity',
  ];
  const relations = await client.query(`
    SELECT c.relname AS name, c.relkind AS kind
      FROM pg_class c
      JOIN pg_namespace n ON n.oid = c.relnamespace
     WHERE n.nspname = 'public'
       AND c.relname = ANY($1::text[])
  `, [relationNames]);
  const relationKinds = new Map(relations.rows.map((row) => [row.name, row.kind]));
  for (const name of relationNames) {
    assert.ok(relationKinds.has(name), `Missing relation: ${name}`);
  }
  assert.equal(relationKinds.get('v_discoverable_entity'), 'v',
    'Discovery projection must remain an actual SQL VIEW');

  const requiredColumns = [
    'id', 'kind', 'location', 'location_h3_r8', 'visibility', 'meta',
  ];
  const columns = await client.query(`
    SELECT column_name
      FROM information_schema.columns
     WHERE table_schema = 'public'
       AND table_name = 'v_discoverable_entity'
  `);
  const present = new Set(columns.rows.map((row) => row.column_name));
  for (const name of requiredColumns) {
    assert.ok(present.has(name), `Missing discoverable-view column: ${name}`);
  }

  const extensions = await client.query(`
    SELECT extname FROM pg_extension
     WHERE extname = ANY($1::text[])
  `, [['postgis', 'pgcrypto', 'citext']]);
  assert.deepEqual(
    extensions.rows.map((row) => row.extname).sort(),
    ['citext', 'pgcrypto', 'postgis'],
  );

  // Compile the real discovery view and normalized membership queries against
  // the complete migrated schema. This is NOT a performance/load assertion.
  const [view] = (await client.query(`
    SELECT COUNT(*)::integer AS n FROM v_discoverable_entity
  `)).rows;
  assert.equal(view.n, 0, 'Fresh migration smoke DB must contain no discoverable entities');
  await client.query(`
    SELECT id, kind, meta FROM v_discoverable_entity
     WHERE location_h3_r8 = ANY($1::text[])
       AND visibility = 'public'
     LIMIT 1
  `, [[]]);
  await client.query(`
    SELECT cm.user_id
      FROM conversation_members cm
      JOIN conversations c ON c.id = cm.conversation_id
     WHERE c.kind = 'group'
       AND cm.left_at IS NULL
     LIMIT 1
  `);
  await client.query('SELECT marketplace_kind FROM listings LIMIT 0');

  console.info('DISCOVERY_FULL_SCHEMA_VALIDATED', JSON.stringify({
    migrations: applied.length, relations: relationNames.length,
    discoveryViewColumns: requiredColumns.length,
    extensions: ['postgis', 'pgcrypto', 'citext'],
    fixture: 'fresh empty disposable PostGIS; no synthetic load or HTTP',
  }));
} finally {
  await client.end();
}
