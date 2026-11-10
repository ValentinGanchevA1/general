'use strict';
const assert = require('node:assert/strict');
const test = require('node:test');
const { describe, preflight } = require('./staging-target-preflight.cjs');

const SOURCE = 'hmtwlkplyjbskljntdkl';
const STAGE = 'abcdefghijklmnopqrst';
const sourceURL = 'postgresql://postgres:SECRET1@db.' + SOURCE + '.supabase.co:5432/postgres?sslmode=require';
const sourcePooler = 'postgresql://postgres.' + SOURCE + ':SECRET2@aws-0-eu-west-1.pooler.supabase.com:5432/postgres';
const stagingURL = 'postgresql://postgres:OTHER@db.' + STAGE + '.supabase.co:5432/postgres';
const opts = { expectedSourceRef: SOURCE, expectedStagingRef: STAGE,
  stagingIsolationAcknowledged: 'YES', backupVerified: 'YES' };

test('identifies direct and pooler sources, never prints passwords', () => {
  const direct = describe(sourceURL);
  const pooled = describe(sourcePooler);
  assert.equal(direct.projectRef, SOURCE);
  assert.equal(pooled.projectRef, SOURCE);
  assert.equal(direct.db, 'postgres');
  assert.ok(!JSON.stringify(direct).includes('SECRET1'));
});

test('different staging project is evidence only, never restore authorization', () => {
  const report = preflight(sourceURL, stagingURL, opts);
  assert.equal(report.checksPassed, true);
  assert.deepEqual(report.issues, []);
  assert.match(report.disposition, /NOT_RESTORE_AUTHORIZATION/);
  assert.ok(!JSON.stringify(report).includes('SECRET1'));
  assert.ok(!JSON.stringify(report).includes('OTHER'));
});

test('rejects same project across direct / pooler hostnames', () => {
  const report = preflight(sourceURL, sourcePooler, { ...opts, expectedStagingRef: SOURCE });
  assert.equal(report.checksPassed, false);
  assert.ok(report.issues.some((x) => x.includes('same Supabase project')));
});

test('rejects same physical destination despite changed password', () => {
  const report = preflight(sourceURL, sourceURL.replace('SECRET1', 'CHANGED'), opts);
  assert.equal(report.checksPassed, false);
  assert.ok(report.issues.some((x) => x.includes('identical')));
});

test('missing backup or staging isolation fail closed', () => {
  const report = preflight(sourceURL, stagingURL, {
    ...opts, backupVerified: 'NO', stagingIsolationAcknowledged: undefined,
  });
  assert.equal(report.checksPassed, false);
  assert.equal(report.issues.filter((x) =>
    x.includes('acknowledged') || x.includes('verified')).length, 2);
});

test('unknown destination identity or mismatched project ref fail closed', () => {
  const local = preflight(sourceURL, 'postgres://postgres:secret@localhost:5432/postgres', opts);
  assert.equal(local.checksPassed, false);
  assert.ok(local.issues.some((x) => x.includes('Staging project identity')));
  assert.equal(preflight(sourceURL, stagingURL, {
    ...opts, expectedSourceRef: STAGE,
  }).checksPassed, false);
});

test('invalid URLs reject without exposing credential text', () => {
  for (const value of [
    '', 'https://foo', 'postgresql://:SECRET@db.example.test/db',
    'postgresql://user:SECRET@db.example.test/',
    'postgresql://user:SECRET@db.example.test:99999/db',
  ]) {
    assert.throws(() => describe(value), (error) =>
      error instanceof Error && !error.message.includes('SECRET'));
  }
});
