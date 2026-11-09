'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const { resolveDatabaseUrl } = require('./preview-db-guard');

const PROD = 'postgresql://prod-user:private-password@db.example:5432/nexus';
const PREVIEW = 'postgresql://test-user:other-secret@test-db.example:5432/nexus_preview';

test('non-preview keeps existing DATABASE_URL without new requirements', () => {
  assert.equal(resolveDatabaseUrl({ IS_PULL_REQUEST: 'false', DATABASE_URL: PROD }), PROD);
  assert.equal(resolveDatabaseUrl({ DATABASE_URL: PROD }), PROD);
});

test('PR preview fails closed if no dedicated DB has been configured', () => {
  assert.throws(
    () => resolveDatabaseUrl({ IS_PULL_REQUEST: 'true', DATABASE_URL: PROD }),
    /Render PR preview database isolation is unverified/,
  );
});

test('PR preview rejects inherited DATABASE_URL even with another user/password', () => {
  const alias = 'postgres://different:credentials@DB.EXAMPLE:5432/nexus?sslmode=require';
  assert.throws(
    () => resolveDatabaseUrl({
      IS_PULL_REQUEST: 'true',
      DATABASE_URL: PROD,
      NEXUS_PREVIEW_DATABASE_URL: alias,
    }),
    /isolation is unverified/,
  );
});

test('PR preview rejects equal or malformed database URLs', () => {
  for (const candidate of [PROD, '', 'not-a-database', 'https://db.example/nexus']) {
    assert.throws(
      () => resolveDatabaseUrl({
        IS_PULL_REQUEST: 'true',
        DATABASE_URL: PROD,
        NEXUS_PREVIEW_DATABASE_URL: candidate,
      }),
      /isolation is unverified/,
    );
  }
});

test('PR preview selects a separate database explicitly', () => {
  assert.equal(
    resolveDatabaseUrl({
      IS_PULL_REQUEST: 'true',
      DATABASE_URL: PROD,
      NEXUS_PREVIEW_DATABASE_URL: PREVIEW,
    }),
    PREVIEW,
  );
});

test('PR preview also accepts a separate database name on the same server', () => {
  const sameHostDifferentDb = 'postgresql://test-user:other-password@db.example/nexus_preview';
  assert.equal(
    resolveDatabaseUrl({
      IS_PULL_REQUEST: 'true',
      DATABASE_URL: PROD,
      NEXUS_PREVIEW_DATABASE_URL: sameHostDifferentDb,
    }),
    sameHostDifferentDb,
  );
});

test('guard errors never reveal credentials or connection strings', () => {
  assert.throws(
    () => resolveDatabaseUrl({ IS_PULL_REQUEST: 'true', DATABASE_URL: PROD }),
    (error) => {
      assert.equal(error instanceof Error, true);
      assert.equal(error.message.includes('private-password'), false);
      assert.equal(error.message.includes('db.example'), false);
      return true;
    },
  );
});
