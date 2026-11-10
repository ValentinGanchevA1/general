'use strict';

const assert = require('node:assert/strict');
const test = require('node:test');
const { describeTarget, inspectReadOnly } = require('./db-target-attestation.cjs');

test('database target describes only nonsecret fields with stable digest', () => {
  const first = describeTarget('postgresql://postgres:VERY_SECRET@db.example.test:5432/postgres?sslmode=require');
  const second = describeTarget('postgres://postgres:ANOTHER_SECRET@db.example.test/postgres');
  assert.deepEqual(
    { host: first.host, port: first.port, database: first.database, user: first.user },
    { host: 'db.example.test', port: 5432, database: 'postgres', user: 'postgres' },
  );
  assert.equal(first.identityDigest, second.identityDigest);
  assert.equal(first.identityDigest.length, 64);
  assert.equal(JSON.stringify(first).includes('VERY_SECRET'), false);
  assert.equal(JSON.stringify(first).includes('sslmode'), false);
});

test('database target rejects unsafe and malformed URLs without echoing secrets', () => {
  for (const value of [
    undefined, '', 'http://example.test',
    'postgresql://dbuser:SENSITIVE_PASSWORD@example.test',
    'postgresql://:SENSITIVE_PASSWORD@example.test/testdb',
    'postgresql://dbuser:SENSITIVE_PASSWORD@example.test/',
  ]) {
    assert.throws(() => describeTarget(value), (error) =>
      error instanceof Error && !error.message.includes('SENSITIVE_PASSWORD'));
  }
});

function fakeDatabase({ names = ['0001_initial.sql'], readOnly = 'on', failSelect = false } = {}) {
  const statements = [];
  const client = {
    async query(sql) {
      statements.push(sql);
      if (sql.startsWith('BEGIN') || sql === 'ROLLBACK') return { rows: [] };
      if (sql.includes('current_setting')) return {
        rows: [{ db: 'postgres', role: 'postgres', read_only: readOnly }],
      };
      if (failSelect) throw new Error('Simulated read failure');
      if (sql.startsWith('SELECT filename')) return { rows: names.map((filename) => ({ filename })) };
      throw new Error('Unexpected SQL');
    },
  };
  return { client, statements };
}

test('read-only transaction checks actual DB identity and snapshot without mutations', async () => {
  const { client, statements } = fakeDatabase();
  const report = await inspectReadOnly(client, ['0001_initial.sql']);
  assert.deepEqual(report.serverIdentity, { database: 'postgres', databaseUser: 'postgres' });
  assert.equal(report.transactionReadOnly, true);
  assert.equal(report.snapshotMatch, true);
  assert.match(report.disposition, /BLOCKED/);
  assert.equal(statements[0], 'BEGIN TRANSACTION ISOLATION LEVEL REPEATABLE READ READ ONLY');
  assert.equal(statements.at(-1), 'ROLLBACK');
  assert.equal(statements.filter((sql) => /^SELECT/.test(sql)).length, 2);
  assert.equal(statements.some((sql) => /\b(?:UPDATE|INSERT|DELETE|ALTER|DROP|CREATE)\b/i.test(sql)), false);
});

test('unexpected or duplicate migration names do not establish a safe snapshot', async () => {
  for (const names of [['0001_initial.sql', '0099_unknown.sql'], ['0001_initial.sql', '0001_initial.sql']]) {
    const { client } = fakeDatabase({ names });
    const result = await inspectReadOnly(client, ['0001_initial.sql']);
    assert.equal(result.snapshotMatch, false);
    assert.match(result.disposition, /BLOCKED/);
  }
});

test('audit refuses non-read-only transaction and always rolls back on SQL errors', async () => {
  const a = fakeDatabase({ readOnly: 'off' });
  await assert.rejects(inspectReadOnly(a.client, []), /not read-only/);
  assert.equal(a.statements.at(-1), 'ROLLBACK');
  assert.equal(a.statements.some((sql) => sql.startsWith('SELECT filename')), false);

  const b = fakeDatabase({ failSelect: true });
  await assert.rejects(inspectReadOnly(b.client, []), /Simulated read failure/);
  assert.equal(b.statements.at(-1), 'ROLLBACK');
});
