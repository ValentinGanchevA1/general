// Runs all migration files in apps/backend/migrations/ in filename order.
// Usage: node scripts/migrate.js
// Requires DATABASE_URL (or apps/backend/.env via dotenv).
const { Client } = require('pg');
const fs = require('fs');
const path = require('path');
require('dotenv').config({ path: require('path').resolve(__dirname, '../.env') });
const { resolveDatabaseUrl } = require('./preview-db-guard');
const { assertMigrationHistoryCompatible } = require('./migration-history-guard');

async function run(client) {
  // Resolve local filenames before any SQL mutation, then compare the applied
  // history read-only. Stale deploys must not rewrite migration metadata or
  // launch SQL when draft preview migrations exist in this database.
  const migrationsDir = path.join(__dirname, '..', 'migrations');
  const files = fs.readdirSync(migrationsDir).filter((file) => file.endsWith('.sql')).sort();

  const RENAMES = [
    { from: '0030_profile_origin.sql', to: '0031_profile_origin.sql' },
    {
      from: '0047_personal_activity_notifications.sql',
      to: '0049_personal_activity_notifications.sql',
    },
    {
      from: '0048_personal_activity_notifications.sql',
      to: '0049_personal_activity_notifications.sql',
    },
  ];
  await assertMigrationHistoryCompatible(
    client,
    files,
    RENAMES.map(({ from }) => from),
  );

  await client.query(`
    CREATE TABLE IF NOT EXISTS schema_migrations (
      filename TEXT PRIMARY KEY,
      applied_at TIMESTAMPTZ NOT NULL DEFAULT now()
    )
  `);

  // Never infer an applied migration baseline from an existing users table.
  // The read-only preflight above rejects missing/empty tracking on populated
  // databases; new databases continue from migration 0001 as usual.

  // Filename renames when a migration was renumbered after already applying
  // under the old name (tracked by filename PRIMARY KEY). Idempotent.

  for (const { from, to } of RENAMES) {
    const renamed = await client.query(
      `UPDATE schema_migrations SET filename = $1
         WHERE filename = $2
           AND NOT EXISTS (
             SELECT 1 FROM schema_migrations WHERE filename = $1
           )`,
      [to, from],
    );
    if (renamed.rowCount > 0) {
      console.log(`Renamed schema_migrations: ${from} → ${to}`);
    }
  }

  const { rows: applied } = await client.query(
    'SELECT filename FROM schema_migrations',
  );
  const appliedSet = new Set(applied.map((r) => r.filename));

  for (const file of files) {
    if (appliedSet.has(file)) {
      console.log(`Skipping (already applied): ${file}`);
      continue;
    }
    const sqlPath = path.join(migrationsDir, file);
    const sql = fs.readFileSync(sqlPath, 'utf8');
    console.log(`Running migration: ${file}`);
    await client.query('BEGIN');
    try {
      await client.query(sql);
      await client.query(
        'INSERT INTO schema_migrations (filename) VALUES ($1)',
        [file],
      );
      await client.query('COMMIT');
    } catch (err) {
      await client.query('ROLLBACK');
      throw err;
    }
  }

  console.log('Done.');
}

async function main() {
  // Never run PR-preview migrations against the parent's inherited DATABASE_URL.
  const connectionString = resolveDatabaseUrl(process.env);
  if (!connectionString) {
    console.error(
      'DATABASE_URL is required. Set it in the environment or in apps/backend/.env',
    );
    process.exit(1);
  }
  const client = new Client({ connectionString });
  await client.connect();
  try {
    await run(client);
  } finally {
    await client.end();
  }
}

if (require.main === module) {
  main().catch((err) => {
    console.error('Migration failed:', err.message || err.name || '(no message)');
    if (err.code) console.error('code:', err.code);
    if (err.cause) console.error('cause:', err.cause);
    if (err.stack) console.error(err.stack);
    process.exit(1);
  });
}

// Export the actual runner for read-only drift regression tests. Requiring this
// module must never connect to a database or invoke production migrations.
module.exports = { run };
