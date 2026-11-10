import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { existsSync, mkdtempSync, readFileSync, rmSync, symlinkSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { test } from 'node:test';
import { inspectBackupDirectory, safePrivateDirectory, writePrivateEvidence } from './verify-g88-local-backup.mjs';

test('backup integrity reports only nonsecret metadata and never a restore PASS', async () => {
  const dir = mkdtempSync(join(tmpdir(), 'nexus-g88-private-backup-'));
  try {
    writeFileSync(join(dir, 'roles.sql'), '');
    writeFileSync(join(dir, 'schema.sql'), 'CREATE TABLE sandbox_test (id integer);');
    writeFileSync(join(dir, 'data.sql'), 'COPY sandbox_test FROM stdin;\n1\n\\.\n');
    const evidence = await inspectBackupDirectory(dir);
    assert.equal(evidence.files.length, 3);
    assert.deepEqual(evidence.files.map((entry) => entry.filename), [
      'roles.sql', 'schema.sql', 'data.sql',
    ]);
    assert.equal(evidence.files[0].bytes, 0, 'empty roles export may be valid');
    assert.equal(evidence.files[1].sha256,
      createHash('sha256').update('CREATE TABLE sandbox_test (id integer);').digest('hex'));
    assert.equal(evidence.sourceDatabaseAttested, false);
    assert.equal(evidence.restoreTestPassed, false);
    assert.equal(evidence.productionDeploymentApproved, false);
    assert.match(evidence.releaseDisposition, /NO_GO/);
    assert.ok(!JSON.stringify(evidence).includes('sandbox_test'));
    const name = writePrivateEvidence(dir, evidence);
    assert.equal(name, 'NEXUS_PRIVATE_BACKUP_EVIDENCE.json');
    assert.deepEqual(JSON.parse(readFileSync(join(dir, name), 'utf8')), evidence);
    assert.throws(() => writePrivateEvidence(dir, evidence), /exists/);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test('reject empty schema/data and paths within the tracked repository', async () => {
  const dir = mkdtempSync(join(tmpdir(), 'nexus-g88-backup-empty-'));
  try {
    writeFileSync(join(dir, 'roles.sql'), '');
    writeFileSync(join(dir, 'schema.sql'), '');
    writeFileSync(join(dir, 'data.sql'), 'example');
    await assert.rejects(inspectBackupDirectory(dir), /empty/);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
  assert.throws(() => safePrivateDirectory(process.cwd()), /tracked repository/);
});

test('reject backup file symlinks escaping chosen directory', async () => {
  const dir = mkdtempSync(join(tmpdir(), 'nexus-g88-backup-link-'));
  const outside = mkdtempSync(join(tmpdir(), 'nexus-g88-outside-'));
  try {
    writeFileSync(join(dir, 'roles.sql'), '');
    writeFileSync(join(dir, 'schema.sql'), 'CREATE TABLE example (id text);');
    writeFileSync(join(outside, 'data.sql'), 'not within backup');
    symlinkSync(join(outside, 'data.sql'), join(dir, 'data.sql'));
    await assert.rejects(inspectBackupDirectory(dir), /escapes/);
  } finally {
    rmSync(dir, { recursive: true, force: true });
    rmSync(outside, { recursive: true, force: true });
  }
});
