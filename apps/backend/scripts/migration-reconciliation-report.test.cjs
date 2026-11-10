'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { spawnSync } = require('node:child_process');
const { auditMigrationHistory, readOwnerSnapshot, HISTORICAL } =
  require('./migration-reconciliation-report.cjs');
const { assertMigrationHistoryCompatible } = require('./migration-history-guard');

const localFiles = fs.readdirSync(path.join(__dirname, '..', 'migrations'))
  .filter((filename) => filename.endsWith('.sql'));
const appliedFiles = readOwnerSnapshot(
  path.join(__dirname, 'fixtures', 'migration-history-owner-20261110.txt'),
);

test('owner-supplied history matches exactly 85 applied / 70 checkout / 15 unknown names', () => {
  const report = auditMigrationHistory(appliedFiles, localFiles);
  assert.equal(report.appliedCount, 85);
  assert.equal(report.checkoutCount, 70);
  assert.equal(report.missingFromCheckoutCount, 15);
  assert.deepEqual(
    report.missingFromCheckout.map(({ filename }) => filename),
    Object.keys(HISTORICAL).sort(),
  );
  assert.deepEqual(report.checkoutFilesNotRecorded, []);
  assert.deepEqual(report.duplicatePrefixes, [
    '0036', '0037', '0038', '0051', '0054', '0072', '0073',
  ]);
  assert.equal(report.matchesOwnerSnapshot, true);
  assert.equal(report.disposition, 'BLOCKED_RECONCILIATION_REVIEW_REQUIRED');
  assert.equal(report.auditReadsDatabase, false);
  assert.ok(!Object.hasOwn(report, 'migrationRunnerUnchanged'));
  assert.ok(!Object.hasOwn(report, 'databaseWritesPerformed'));
});

test('five apparent renames do not authorize migration runner or claim SQL execution', () => {
  const report = auditMigrationHistory(appliedFiles, localFiles);
  const renames = report.missingFromCheckout.filter((row) => row.successor);
  assert.equal(renames.length, 5);
  assert.ok(renames.every((row) => row.successorRecorded === true));
  assert.equal(renames.filter((row) => row.kind === 'historical-source-unverified').length, 2);
  assert.ok(!Object.hasOwn(report, 'allowMigration'));
});

test('unknown new migration fails inventory match, never silently gets whitelisted', () => {
  const report = auditMigrationHistory([...appliedFiles, '0099_surprise_draft.sql'], localFiles);
  assert.equal(report.missingFromCheckoutCount, 16);
  assert.equal(report.matchesOwnerSnapshot, false);
  assert.equal(
    report.missingFromCheckout.find((row) => row.filename === '0099_surprise_draft.sql').kind,
    'UNKNOWN_UNRECOGNIZED',
  );
  assert.equal(report.disposition, 'BLOCKED_RECONCILIATION_REVIEW_REQUIRED');
});

test('changed checkout breaks snapshot match; not-applied migration is surfaced', () => {
  const report = auditMigrationHistory(
    appliedFiles.slice(1),
    [...localFiles, '0078_new_schema.sql'],
  );
  assert.equal(report.matchesOwnerSnapshot, false);
  assert.deepEqual(report.checkoutFilesNotRecorded, ['0001_initial.sql', '0078_new_schema.sql']);
});

test('invalid filenames and duplicated metadata fail instead of being interpreted', () => {
  assert.throws(() => auditMigrationHistory(['../../secret.sql'], localFiles), /invalid/);
  assert.throws(() => auditMigrationHistory(
    [...appliedFiles, appliedFiles[0]],
    localFiles,
  ), /duplicate/);
  assert.throws(() => auditMigrationHistory(appliedFiles, [...localFiles, 'not-a-migration']), /invalid/);
});

test('actual production migration guard still refuses all 15 mismatches before writes', async () => {
  const queries = [];
  const db = {
    async query(sql) {
      queries.push(String(sql));
      if (String(sql).includes("to_regclass('public.schema_migrations')")) {
        return { rows: [{ tracker_table: 'schema_migrations' }] };
      }
      if (String(sql).startsWith('SELECT filename FROM public.schema_migrations')) {
        return { rows: appliedFiles.map((filename) => ({ filename })) };
      }
      throw new Error('unexpected SQL: write or extra query');
    },
  };
  await assert.rejects(
    assertMigrationHistoryCompatible(db, localFiles, [
      '0030_profile_origin.sql',
      '0047_personal_activity_notifications.sql',
      '0048_personal_activity_notifications.sql',
    ]),
    (err) => err.code === 'MIGRATION_HISTORY_DRIFT' && /15 applied/.test(err.message),
  );
  assert.equal(queries.length, 2);
  assert.ok(queries.every((sql) => sql.startsWith('SELECT ')));
});

test('offline CLI always exits nonzero and reports BLOCKED even on matching fixture', () => {
  const cli = spawnSync(process.execPath, [
    path.join(__dirname, 'migration-reconciliation-report.cjs'),
  ], { encoding: 'utf8', timeout: 5000, env: {} });
  assert.equal(cli.status, 2);
  assert.equal(cli.stderr, '');
  const report = JSON.parse(cli.stdout);
  assert.equal(report.matchesOwnerSnapshot, true);
  assert.equal(report.missingFromCheckoutCount, 15);
  assert.equal(report.disposition, 'BLOCKED_RECONCILIATION_REVIEW_REQUIRED');
  assert.equal(report.auditReadsDatabase, false);
});

test('legacy 0051/0054/0069 inventory is SELECT-only inside a read-only transaction', () => {
  const sqlPath = path.join(
    __dirname, '..', '..', '..',
    'docs', 'qa', 'NEXUS_LEGACY_MIGRATIONS_0051_0054_0069_READONLY_2026-11-10.sql',
  );
  const sql = fs.readFileSync(sqlPath, 'utf8');
  const statements = sql.split('\n')
    .filter((line) => !line.trim().startsWith('--')).join('\n');
  assert.match(statements, /BEGIN TRANSACTION ISOLATION LEVEL REPEATABLE READ READ ONLY;/);
  assert.match(statements, /current_setting\('transaction_read_only'\)/);
  assert.match(statements, /FROM public\.schema_migrations/);
  assert.match(statements, /SELECT pg_get_function_identity_arguments|pg_get_function_identity_arguments/);
  assert.match(statements, /COMMIT;\s*$/);
  assert.doesNotMatch(
    statements,
    /\b(?:INSERT|UPDATE|DELETE|ALTER|DROP|CREATE|TRUNCATE|GRANT|REVOKE|CALL|DO|EXECUTE|COPY)\b/i,
  );
});
