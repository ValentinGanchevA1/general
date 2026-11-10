'use strict';

// REAL PostgreSQL integration tests. Connect ONLY to the disposable Postgres
// service on GitHub Actions localhost; ignore DATABASE_URL and all production
// connection strings, even if inherited into CI.
const test = require('node:test');
const assert = require('node:assert/strict');
const { randomBytes } = require('node:crypto');
const { Client } = require('pg');
const fs = require('node:fs');
const path = require('node:path');
const { run } = require('./migrate');
const { assertMigrationHistoryCompatible } = require('./migration-history-guard');

const enabled = process.env.GITHUB_ACTIONS === 'true' &&
  process.env.CI === 'true' &&
  process.env.NEXUS_EPHEMERAL_PG_INTEGRATION === 'true';

// Never read DATABASE_URL or other connected secrets.
const CONTROL_URL = 'postgresql://nexa_test:nexa_test@127.0.0.1:5432/nexa_test';

async function withDisposableDatabase(callback) {
  const admin = new Client({ connectionString: CONTROL_URL });
  await admin.connect();
  const name = `nexus_migration_ci_${randomBytes(6).toString('hex')}`;
  let db = null;
  try {
    await admin.query(`CREATE DATABASE "${name}"`);
    db = new Client({
      host: '127.0.0.1',
      port: 5432,
      database: name,
      user: 'nexa_test',
      password: 'nexa_test',
    });
    await db.connect();
    return await callback(db);
  } finally {
    if (db) await db.end();
    try {
      await admin.query(`DROP DATABASE IF EXISTS "${name}" WITH (FORCE)`);
    } finally {
      await admin.end();
    }
  }
}

test('PostgreSQL migration safety — isolated CI cluster only', { skip: !enabled }, async (t) => {
  await t.test('existing users table + missing tracker: NO tracking table is created', async () => {
    await withDisposableDatabase(async (db) => {
      await db.query('CREATE TABLE public.users (id uuid PRIMARY KEY)');
      await assert.rejects(run(db), { code: 'MIGRATION_HISTORY_UNTRACKED' });
      const tracker = await db.query("SELECT to_regclass('public.schema_migrations') AS relation");
      assert.equal(tracker.rows[0].relation, null);
      const userTable = await db.query("SELECT to_regclass('public.users') AS relation");
      assert.equal(userTable.rows[0].relation, 'users');
    });
  });

  await t.test('existing users table + empty tracker: NO fake baseline rows', async () => {
    await withDisposableDatabase(async (db) => {
      await db.query('CREATE TABLE public.users (id uuid PRIMARY KEY)');
      await db.query('CREATE TABLE public.schema_migrations (filename text PRIMARY KEY, applied_at timestamptz DEFAULT now())');
      await assert.rejects(run(db), { code: 'MIGRATION_HISTORY_UNTRACKED' });
      const result = await db.query('SELECT COUNT(*)::int AS count FROM public.schema_migrations');
      assert.equal(result.rows[0].count, 0);
    });
  });

  await t.test('unknown production-only 0077 migration: NO replay, no visibility change', async () => {
    await withDisposableDatabase(async (db) => {
      await db.query("CREATE TABLE public.users (id uuid PRIMARY KEY, visibility text NOT NULL DEFAULT 'private')");
      await db.query("INSERT INTO public.users (id, visibility) VALUES ('11111111-1111-1111-1111-111111111111', 'private')");
      await db.query('CREATE TABLE public.schema_migrations (filename text PRIMARY KEY, applied_at timestamptz DEFAULT now())');
      await db.query("INSERT INTO public.schema_migrations (filename) VALUES ('0077_adult_only_rc1_visibility.sql')");
      await assert.rejects(run(db), { code: 'MIGRATION_HISTORY_DRIFT' });
      const history = await db.query('SELECT filename FROM public.schema_migrations');
      assert.deepEqual(history.rows.map((row) => row.filename), ['0077_adult_only_rc1_visibility.sql']);
      const users = await db.query('SELECT visibility FROM public.users');
      assert.deepEqual(users.rows.map((row) => row.visibility), ['private']);
    });
  });

  await t.test('brand-new database has no user/tracker and passes preflight without mutation', async () => {
    await withDisposableDatabase(async (db) => {
      await assert.doesNotReject(
        assertMigrationHistoryCompatible(db, ['0001_initial.sql']),
      );
      const state = await db.query(
        "SELECT to_regclass('public.users') AS users, to_regclass('public.schema_migrations') AS tracker",
      );
      assert.deepEqual(state.rows[0], { users: null, tracker: null });
    });
  });

  await t.test('legacy audit SQL parses and stays read-only on disposable PostgreSQL', async () => {
    await withDisposableDatabase(async (db) => {
      await db.query(
        'CREATE TABLE public.schema_migrations (filename text PRIMARY KEY, applied_at timestamptz DEFAULT now())',
      );
      await db.query(
        "INSERT INTO public.schema_migrations (filename) VALUES ('0069_realtime_room_revocation_outbox.sql')",
      );
      const sql = fs.readFileSync(path.join(
        __dirname, '..', '..', '..', 'docs', 'qa',
        'NEXUS_LEGACY_MIGRATIONS_0051_0054_0069_READONLY_2026-11-10.sql',
      ), 'utf8');
      const results = await db.query(sql);
      assert.ok(Array.isArray(results));
      const identity = results.find((result) =>
        result.rows?.some((row) => row.read_only === 'on'));
      assert.ok(identity, 'audit must confirm a read-only transaction');
      const inventory = results.find((result) =>
        result.rows?.some((row) => row.section === 'relations'));
      assert.ok(inventory, 'catalog inventory must include relations');
      const relationRow = inventory.rows.find((row) => row.section === 'relations');
      assert.equal(relationRow.metadata.length, 13);
      const tracker = await db.query('SELECT filename FROM public.schema_migrations');
      assert.deepEqual(tracker.rows, [
        { filename: '0069_realtime_room_revocation_outbox.sql' },
      ]);
    });
  });

  await t.test('runner updates public tracker even when search_path points to shadow', async () => {
    await withDisposableDatabase(async (db) => {
      await db.query('CREATE SCHEMA shadow');
      await db.query('CREATE TABLE shadow.schema_migrations (filename text PRIMARY KEY)');
      await db.query("INSERT INTO shadow.schema_migrations (filename) VALUES ('shadow_decoy.sql')");
      await db.query('CREATE TABLE public.schema_migrations (filename text PRIMARY KEY, applied_at timestamptz DEFAULT now())');
      const migrationDir = path.join(__dirname, '..', 'migrations');
      const names = fs.readdirSync(migrationDir).filter((x) => x.endsWith('.sql')).sort();
      for (const filename of names) {
        await db.query('INSERT INTO public.schema_migrations (filename) VALUES ($1)', [filename]);
      }
      await db.query('SET search_path = shadow, public');
      await run(db);
      const shadow = await db.query('SELECT filename FROM shadow.schema_migrations');
      assert.deepEqual(shadow.rows.map((row) => row.filename), ['shadow_decoy.sql']);
      const publicRows = await db.query('SELECT COUNT(*)::int AS count FROM public.schema_migrations');
      assert.equal(publicRows.rows[0].count, names.length);
    });
  });
});
