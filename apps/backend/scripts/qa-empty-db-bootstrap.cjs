'use strict';

/**
 * Disposable-only bootstrap smoke test for the current source-controlled
 * migration set. It refuses all remote database targets before opening a
 * connection. This is not a staging restore, production attestation, or
 * migration-history reconciliation.
 */
const fs = require('node:fs');
const path = require('node:path');
const { Client } = require('pg');
const { run } = require('./migrate.js');

function assertDisposableTarget(raw) {
  if (typeof raw !== 'string' || raw.length === 0) {
    throw new Error('DATABASE_URL is required for the disposable migration smoke test');
  }
  let url;
  try {
    url = new URL(raw);
  } catch {
    throw new Error('DATABASE_URL is malformed (value redacted)');
  }
  const database = decodeURIComponent(url.pathname.replace(/^\//, ''));
  if (
    !['postgres:', 'postgresql:'].includes(url.protocol) ||
    !['127.0.0.1', 'localhost'].includes(url.hostname) ||
    (url.port || '5432') !== '5432' ||
    url.username !== 'nexa_qa' ||
    database !== 'nexa_qa_bootstrap'
  ) {
    throw new Error('Refusing non-disposable database target (connection details redacted)');
  }
  return true;
}

async function main() {
  const databaseUrl = process.env.DATABASE_URL;
  assertDisposableTarget(databaseUrl);

  const migrationDirectory = path.join(__dirname, '..', 'migrations');
  const expected = fs.readdirSync(migrationDirectory)
    .filter((name) => name.endsWith('.sql'))
    .sort();

  const client = new Client({
    connectionString: databaseUrl,
    connectionTimeoutMillis: 8000,
    query_timeout: 30000,
  });

  try {
    await client.connect();
    await run(client);

    await client.query('BEGIN TRANSACTION ISOLATION LEVEL REPEATABLE READ READ ONLY');
    try {
      const identity = await client.query(
        "SELECT current_setting('server_version_num')::integer AS version_num, " +
        "current_setting('transaction_read_only') AS read_only",
      );
      const versionNum = identity.rows[0]?.version_num;
      if (!Number.isInteger(versionNum) || Math.floor(versionNum / 10000) !== 17) {
        throw new Error('Disposable bootstrap did not run on PostgreSQL 17');
      }
      if (identity.rows[0]?.read_only !== 'on') {
        throw new Error('Verification transaction is not read-only');
      }

      const tracker = await client.query(
        'SELECT filename FROM public.schema_migrations ORDER BY filename',
      );
      const actual = tracker.rows.map((row) => row.filename);
      if (
        actual.length !== expected.length ||
        new Set(actual).size !== actual.length ||
        actual.some((filename, index) => filename !== expected[index])
      ) {
        throw new Error('Applied migration tracker differs from the source-controlled migration set');
      }

      const required = await client.query(
        `SELECT
           to_regclass('public.users') IS NOT NULL AS users_exists,
           to_regclass('public.schema_migrations') IS NOT NULL AS tracker_exists,
           EXISTS (SELECT 1 FROM pg_extension WHERE extname = 'postgis') AS postgis_exists,
           EXISTS (SELECT 1 FROM pg_extension WHERE extname = 'citext') AS citext_exists,
           EXISTS (SELECT 1 FROM pg_extension WHERE extname = 'pgcrypto') AS pgcrypto_exists`,
      );
      const row = required.rows[0];
      if (!row?.users_exists || !row?.tracker_exists ||
          !row?.postgis_exists || !row?.citext_exists || !row?.pgcrypto_exists) {
        throw new Error('Required fresh-schema objects or extensions are missing');
      }

      process.stdout.write(JSON.stringify({
        postgresMajor: 17,
        sourceMigrationFileCount: expected.length,
        appliedMigrationCount: actual.length,
        migrationNamesMatch: true,
        requiredExtensionsPresent: true,
        disposableTargetOnly: true,
      }, null, 2) + '\n');
    } finally {
      await client.query('ROLLBACK');
    }
  } finally {
    await client.end().catch(() => undefined);
  }
}

if (require.main === module) {
  main().catch((error) => {
    // Do not print a connection string or any environment values.
    process.stderr.write(`Disposable PostgreSQL migration bootstrap failed: ${error.message}\n`);
    process.exitCode = 1;
  });
}

module.exports = { assertDisposableTarget };
