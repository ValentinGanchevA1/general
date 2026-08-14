#!/usr/bin/env node
/**
 * Prints recent schema_migrations rows and flags the dual-0030 collision.
 * Usage: DATABASE_URL=... node scripts/check-schema-migrations.mjs
 */
import pg from 'pg';

const url = process.env.DATABASE_URL;
if (!url) {
  console.error('Set DATABASE_URL');
  process.exit(1);
}

const client = new pg.Client({ connectionString: url });
await client.connect();
try {
  const { rows } = await client.query(
    `SELECT filename, applied_at
       FROM schema_migrations
      WHERE filename LIKE '003%'
         OR filename LIKE '0029%'
      ORDER BY filename`,
  );
  console.log('Recent migrations:');
  for (const r of rows) {
    console.log(`  ${r.filename}  @ ${r.applied_at?.toISOString?.() ?? r.applied_at}`);
  }

  const names = new Set(rows.map((r) => r.filename));
  const hasOld = names.has('0030_profile_origin.sql');
  const hasNew = names.has('0031_profile_origin.sql');
  const hasChat = names.has('0030_chat_location_share.sql');

  console.log('\nCollision check:');
  console.log(`  0030_chat_location_share.sql: ${hasChat ? 'applied' : 'missing'}`);
  console.log(`  0030_profile_origin.sql (legacy name): ${hasOld ? 'STILL PRESENT — run migration:run to rename' : 'absent (ok)'}`);
  console.log(`  0031_profile_origin.sql: ${hasNew ? 'applied' : 'missing — will apply/rename on next migration:run'}`);

  if (hasOld && hasNew) {
    console.error('\nWARN: both legacy and new profile_origin filenames present — investigate manually.');
    process.exit(2);
  }
  if (hasOld && !hasNew) {
    console.log('\nNext migration:run will rename 0030_profile_origin → 0031_profile_origin in schema_migrations.');
  }
  if (!hasOld && !hasNew) {
    console.log('\nprofile_origin not applied yet — next migration:run will apply 0031_profile_origin.sql.');
  }
  if (!hasOld && hasNew) {
    console.log('\nOK: dual-0030 collision resolved in tracker.');
  }
} finally {
  await client.end();
}
