import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import test from 'node:test';

const sqlFile = fileURLToPath(
  new URL('../../ops/sql/G88_SUPABASE_API_ROLE_ACL_HOTFIX_2026-11-10.sql', import.meta.url),
);

test('G88 Supabase ACL hotfix is privilege-reducing and cannot rewrite app data or migration history', () => {
  const source = readFileSync(sqlFile, 'utf8');
  const statements = source.split(/\r?\n/).filter((line) => !line.trimStart().startsWith('--')).join('\n');
  assert.match(statements, /DO \$g88_table_acl_hardening\$/);
  assert.match(statements, /DO \$g88_sequence_acl_hardening\$/);
  assert.match(statements, /lock_timeout/);
  assert.match(statements, /REVOKE ALL PRIVILEGES ON ALL TABLES IN SCHEMA public FROM anon, authenticated/);
  assert.match(statements, /REVOKE ALL PRIVILEGES ON ALL SEQUENCES IN SCHEMA public FROM anon, authenticated/);
  assert.match(statements, /ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA public REVOKE ALL PRIVILEGES ON TABLES FROM anon, authenticated/);
  assert.match(statements, /ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA public REVOKE ALL PRIVILEGES ON SEQUENCES FROM anon, authenticated/);
  assert.match(statements, /RAISE EXCEPTION/);
  assert.doesNotMatch(statements, /\bGRANT\s+(?:ALL|SELECT|INSERT|UPDATE|DELETE|EXECUTE)\b/i);
  assert.doesNotMatch(statements, /\b(?:INSERT\s+INTO|DELETE\s+FROM|UPDATE\s+public\.|DROP\s+TABLE|ALTER\s+TABLE|TRUNCATE\s+TABLE|CREATE\s+TABLE)\b/i);
  assert.doesNotMatch(statements, /\b(?:schema_migrations|DATABASE_URL|service_role)\s*[=]/i);
  assert.equal(source.includes('postgresql://'), false);
});
