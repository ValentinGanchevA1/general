// Runs all migration files in apps/backend/migrations/ in filename order.
// Usage: node scripts/migrate.js
const { Client } = require('pg');
const fs = require('fs');
const path = require('path');

async function run() {
  const connectionString =
    process.env.DATABASE_URL ?? 'postgres://g88:g88dev@localhost:5432/g88';
  const client = new Client({ connectionString });
  await client.connect();

  await client.query(`
    CREATE TABLE IF NOT EXISTS schema_migrations (
      filename TEXT PRIMARY KEY,
      applied_at TIMESTAMPTZ NOT NULL DEFAULT now()
    )
  `);

  // Seed: if the users table already exists but isn't tracked, record it now
  // so migrations that predate the tracker aren't re-applied.
  const { rows: existingTables } = await client.query(`
    SELECT tablename FROM pg_tables
    WHERE schemaname = 'public' AND tablename = 'users'
  `);
  if (existingTables.length > 0) {
    const migrationsDir0 = path.join(__dirname, '..', 'migrations');
    const allFiles = fs
      .readdirSync(migrationsDir0)
      .filter((f) => f.endsWith('.sql'))
      .sort();
    // Mark the first migration as applied if it isn't already tracked
    if (allFiles.length > 0) {
      await client.query(
        `INSERT INTO schema_migrations (filename) VALUES ($1) ON CONFLICT DO NOTHING`,
        [allFiles[0]],
      );
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
    await client.query(sql);
    await client.query(
      'INSERT INTO schema_migrations (filename) VALUES ($1)',
      [file],
    );
    await client.query('COMMIT');
  }

  await client.end();
  console.log('Done.');
}

run().catch((err) => {
  console.error('Migration failed:', err.message);
  process.exit(1);
});
