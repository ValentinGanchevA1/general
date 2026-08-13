// Runs all migration files in apps/backend/migrations/ in filename order.
// Usage: node scripts/migrate.js
const { Client } = require('pg');
const fs = require('fs');
const path = require('path');
require('dotenv').config({ path: require('path').resolve(__dirname, '../.env') });
async function run(client) {
  await client.query(`
    CREATE TABLE IF NOT EXISTS schema_migrations (
      filename TEXT PRIMARY KEY,
      applied_at TIMESTAMPTZ NOT NULL DEFAULT now()
    )
  `);

  // Baseline seeding: if schema_migrations is empty AND users table already
  // exists, the DB was bootstrapped before the tracker was introduced.
  // Mark every migration file on disk as applied so none get re-run.
  const { rows: trackedRows } = await client.query(
    'SELECT 1 FROM schema_migrations LIMIT 1',
  );
  if (trackedRows.length === 0) {
    const { rows: existingTables } = await client.query(`
      SELECT tablename FROM pg_tables
      WHERE schemaname = 'public' AND tablename = 'users'
    `);
    if (existingTables.length > 0) {
      const baselineDir = path.join(__dirname, '..', 'migrations');
      const allFiles = fs
        .readdirSync(baselineDir)
        .filter((f) => f.endsWith('.sql'))
        .sort();
      for (const file of allFiles) {
        await client.query(
          `INSERT INTO schema_migrations (filename) VALUES ($1) ON CONFLICT DO NOTHING`,
          [file],
        );
      }
      if (allFiles.length > 0) {
        console.log(`Baseline: marked ${allFiles.length} migration(s) as applied (schema pre-dates tracker).`);
      }
    }
  }

  // Filename renames when a migration was renumbered after already applying
  // under the old name (tracked by filename PRIMARY KEY). Idempotent.
  const RENAMES = [
    { from: '0030_profile_origin.sql', to: '0031_profile_origin.sql' },
  ];
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

  const migrationsDir = path.join(__dirname, '..', 'migrations');
  const files = fs
    .readdirSync(migrationsDir)
    .filter((f) => f.endsWith('.sql'))
    .sort();

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
  const connectionString =
    process.env.DATABASE_URL ?? 'postgres://g88:g88dev@localhost:5432/g88';
  const client = new Client({ connectionString });
  await client.connect();
  try {
    await run(client);
  } finally {
    await client.end();
  }
}

main().catch((err) => {
  console.error('Migration failed:', err.message || err.name || '(no message)');
  if (err.code) console.error('code:', err.code);
  if (err.cause) console.error('cause:', err.cause);
  if (err.stack) console.error(err.stack);
  process.exit(1);
});
