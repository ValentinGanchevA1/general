'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { auditMigrationHistory, readOwnerSnapshot, HISTORICAL } =
  require('./migration-reconciliation-report');
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
  assert.equal(report.databaseWritesPerformed, false);
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
  assert.deepEqual(report.checkoutFilesNotRecorded, ['0078_new_schema.sql']);
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
