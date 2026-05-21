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

  const migrationsDir = path.join(__dirname, '..', 'migrations');
  const files = fs
    .readdirSync(migrationsDir)
    .filter((f) => f.endsWith('.sql'))
    .sort();

  for (const file of files) {
    const sqlPath = path.join(migrationsDir, file);
    const sql = fs.readFileSync(sqlPath, 'utf8');
    console.log(`Running migration: ${file}`);
    await client.query(sql);
  }

  await client.end();
  console.log('Done.');
}

run().catch((err) => {
  console.error('Migration failed:', err.message);
  process.exit(1);
});
