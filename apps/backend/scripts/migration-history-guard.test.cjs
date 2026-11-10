'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const { assertMigrationHistoryCompatible } = require('./migration-history-guard');
const { run } = require('./migrate');

function fakeClient(applied, trackerExists = true) {
  const queries = [];
  const client = {
    async query(sql) {
      queries.push(String(sql));
      if (String(sql).includes('to_regclass')) {
        return { rows: [{ tracker_table: trackerExists ? 'schema_migrations' : null }] };
      }
      if (String(sql).startsWith('SELECT filename FROM public.schema_migrations')) {
        return { rows: applied.map((filename) => ({ filename })) };
      }
      throw new Error('Unexpected or mutating SQL during read-only preflight');
    },
  };
  return { client, queries };
}

test('known applied migration history passes without any write', async () => {
  const { client, queries } = fakeClient(['0001_initial.sql', '0071_coarsen_story_geography.sql']);
  await assertMigrationHistoryCompatible(client, [
    '0001_initial.sql', '0071_coarsen_story_geography.sql',
  ]);
  assert.equal(queries.length, 2);
  assert.ok(queries.every((sql) => sql.startsWith('SELECT ')));
});

test('legacy rename source filenames remain permitted for existing metadata normalization', async () => {
  const { client } = fakeClient(['0030_profile_origin.sql', '0031_profile_origin.sql']);
  await assert.doesNotReject(assertMigrationHistoryCompatible(
    client,
    ['0031_profile_origin.sql'],
    ['0030_profile_origin.sql'],
  ));
});

test('a new database with no migration tracker can use the existing bootstrap flow', async () => {
  const { client, queries } = fakeClient([], false);
  await assertMigrationHistoryCompatible(client, ['0001_initial.sql']);
  assert.equal(queries.length, 1);
});

test('unknown draft migration filenames fail closed and report no secrets', async () => {
  const { client, queries } = fakeClient([
    '0071_coarsen_story_geography.sql',
    '0072_personal_labels.sql',
    '0077_adult_only_rc1_visibility.sql',
  ]);
  await assert.rejects(
    assertMigrationHistoryCompatible(client, ['0071_coarsen_story_geography.sql']),
    (error) => {
      assert.equal(error.code, 'MIGRATION_HISTORY_DRIFT');
      assert.match(error.message, /0072_personal_labels/);
      assert.match(error.message, /0077_adult_only_rc1_visibility/);
      assert.match(error.message, /Refusing all migration writes/);
      return true;
    },
  );
  assert.ok(queries.every((sql) => sql.startsWith('SELECT ')));
});

test('unknown filename output is sanitised to avoid log-control injection', async () => {
  const { client } = fakeClient(['0072_\u001b[31m.sql']);
  await assert.rejects(
    assertMigrationHistoryCompatible(client, []),
    (error) => {
      assert.equal(error.code, 'MIGRATION_HISTORY_DRIFT');
      assert.ok(!error.message.includes('\u001b'));
      return true;
    },
  );
});

test('tracker query failures abort the preflight without attempting any writes', async () => {
  const client = {
    async query() {
      throw new Error('database unreachable');
    },
  };
  await assert.rejects(
    assertMigrationHistoryCompatible(client, ['0001_initial.sql']),
    /database unreachable/,
  );
});

test('actual migration runner rejects production DB drift before CREATE/UPDATE/BEGIN', async () => {
  const { client, queries } = fakeClient([
    '0072_personal_labels.sql',
    '0077_adult_only_rc1_visibility.sql',
  ]);
  await assert.rejects(run(client), { code: 'MIGRATION_HISTORY_DRIFT' });
  assert.deepEqual(
    queries.map((sql) => sql.trim().split(/\s+/)[0]),
    ['SELECT', 'SELECT'],
  );
});
