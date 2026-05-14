// Runs migrations/0001_initial.sql against the configured database.
// Usage: node scripts/migrate.js
const { Client } = require('pg');
const fs = require('fs');
const path = require('path');

async function run() {
  const connectionString =
    process.env.DATABASE_URL ?? 'postgres://g88:g88dev@localhost:5432/g88';
  const client = new Client({ connectionString });
  await client.connect();

  const sqlPath = path.join(__dirname, '..', 'migrations', '0001_initial.sql');
  const sql = fs.readFileSync(sqlPath, 'utf8');

  console.log('Running migration: 0001_initial.sql');
  await client.query(sql);
  await client.end();
  console.log('Done.');
}

run().catch((err) => {
  console.error('Migration failed:', err.message);
  process.exit(1);
});
