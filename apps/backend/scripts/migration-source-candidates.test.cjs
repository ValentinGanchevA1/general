'use strict';

const assert = require('node:assert/strict');
const { createHash } = require('node:crypto');
const { readFileSync } = require('node:fs');
const path = require('node:path');
const test = require('node:test');
const { readOwnerSnapshot, HISTORICAL } = require('./migration-reconciliation-report.cjs');

const manifest = JSON.parse(readFileSync(path.resolve(
  __dirname, '..', '..', '..', 'docs', 'qa',
  'NEXUS_G88_15_SQL_SOURCE_CANDIDATES_2026-11-11.json',
), 'utf8'));

test('historical manifest retains 15 source candidates while 14 remain absent from checkout', () => {
  const snapshot = readOwnerSnapshot(path.join(
    __dirname, 'fixtures', 'migration-history-owner-20261110.txt',
  ));
  const migrationDir = path.join(__dirname, '..', 'migrations');
  const localFiles = new Set(require('node:fs').readdirSync(migrationDir));
  const { entries, databaseEvidence } = manifest;
  const unresolvedEntries = entries.filter((entry) => !localFiles.has(entry.filename));
  assert.equal(snapshot.length, 85);
  assert.equal(entries.length, 15);
  assert.deepEqual(
    entries.map((r) => r.filename).sort(),
    [...snapshot].sort(),
    'historical manifest must retain every owner-snapshot candidate',
  );
  assert.equal(unresolvedEntries.length, 14);
  assert.deepEqual(
    unresolvedEntries.map((r) => r.filename).sort(),
    Object.keys(HISTORICAL).sort(),
    'the 14 remaining absent source names must match the offline drift inventory',
  );

  const restoredChildSafety = entries.find((entry) =>
    entry.filename === '0076_child_safety_report_reason.sql');
  assert.ok(restoredChildSafety);
  assert.ok(localFiles.has(restoredChildSafety.filename));
  const restoredBytes = require('node:fs').readFileSync(
    path.join(migrationDir, restoredChildSafety.filename),
  );
  const restoredGitBlob = createHash('sha1')
    .update(`blob ${restoredBytes.length}\0`)
    .update(restoredBytes)
    .digest('hex');
  assert.equal(restoredGitBlob, restoredChildSafety.sourceGitBlob,
    'restored 0076 source must match the historical candidate blob exactly');
  assert.equal(databaseEvidence.appliedCount, 85);
  assert.equal(databaseEvidence.unmatchedFilenames, 15);
  assert.deepEqual(databaseEvidence.trackerColumns, ['filename', 'applied_at']);
  assert.equal(databaseEvidence.hasSqlChecksums, false);
  assert.equal(databaseEvidence.renderTargetProven, false);
  assert.match(manifest.purpose, /never an executable migration allowlist/i);
  assert.equal(entries.filter((r) => r.status === 'source-unverified').length, 0);
  assert.equal(entries.filter((r) => r.sourceGitBlob !== null).length, 15);
  for (const entry of entries) {
    assert.ok(snapshot.includes(entry.filename));
    assert.ok(entry.status === 'source-unverified' ||
      entry.status === 'candidate-historical-commit' ||
      entry.status === 'candidate-draft-branch');
    if (entry.status === 'source-unverified') {
      assert.equal(entry.sourceCommit, null);
      assert.equal(entry.sourceGitBlob, null);
    } else {
      assert.match(entry.sourceCommit, /^[a-f0-9]{40}$/);
      assert.match(entry.sourceGitBlob, /^[a-f0-9]{40}$/);
    }
    // No field may claim that repository blob evidence proves DB execution.
    assert.ok(!Object.hasOwn(entry, 'applied'));
    assert.ok(!Object.hasOwn(entry, 'executedSqlHash'));
    assert.ok(!Object.hasOwn(entry, 'allowMigration'));
  }
});

test('renumbering candidates are exact Git blob matches but not tracker aliases', () => {
  const byName = new Map(manifest.entries.map((e) => [e.filename, e]));
  assert.equal(
    byName.get('0072_extend_content_report_targets.sql').sourceGitBlob,
    byName.get('0073_extend_content_report_targets.sql').sourceGitBlob,
  );
  assert.equal(
    byName.get('0073_event_question_moderation.sql').sourceGitBlob,
    byName.get('0074_event_question_moderation.sql').sourceGitBlob,
  );
  // This source was reconstructed from PR #829's archived pre-force-push
  // Actions head, not inferred from the current file name.
  assert.equal(
    byName.get('0054_posthog_deletion_queue.sql').sourceGitBlob,
    'f094ca033680ec799b099741e5bf2be409398ee4',
  );
  assert.equal(
    byName.get('0054_posthog_deletion_queue.sql').sourceCommit,
    'bfae85de887eab8917e8db0eeaf780e3e448791b',
  );
  const successorBytes = readFileSync(path.join(
    __dirname, '..', 'migrations', '0062_posthog_deletion_queue.sql',
  ));
  const actualSuccessorGitBlob = createHash('sha1')
    .update(`blob ${successorBytes.length}\0`)
    .update(successorBytes)
    .digest('hex');
  assert.equal(
    actualSuccessorGitBlob,
    byName.get('0054_posthog_deletion_queue.sql').sourceGitBlob,
    'the original 0054 Git blob must match the current 0062 migration bytes',
  );
  assert.notEqual(
    byName.get('0072_personal_labels.sql').sourceGitBlob,
    byName.get('0072_ugc_terms_acceptance.sql').sourceGitBlob,
  );
});
