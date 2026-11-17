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

test('PR preview rejects a separate database name on the production host', () => {
  const sameHostDifferentDb = 'postgresql://test-user:other-password@db.example/nexus_preview';
  assert.throws(() => resolveDatabaseUrl({
    IS_PULL_REQUEST: 'true', DATABASE_URL: PROD,
    NEXUS_PREVIEW_DATABASE_URL: sameHostDifferentDb,
  }), /isolation is unverified/);
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

test('preview-named Render service fails closed when IS_PULL_REQUEST is absent', () => {
  assert.throws(() => resolveDatabaseUrl({
    RENDER_SERVICE_NAME: 'g88-api PR #1055', DATABASE_URL: PROD,
  }), /isolation is unverified/);
  assert.throws(() => resolveDatabaseUrl({
    RENDER_SERVICE_NAME: 'g88-api PR #1074', IS_PULL_REQUEST: 'false',
    DATABASE_URL: PROD, NEXUS_PREVIEW_DATABASE_URL: PREVIEW.replace('test-user', 'prod-user'),
  }), /isolation is unverified/);
});

test('preview rejects dedicated URL with reused production database username', () => {
  const reused = 'postgresql://prod-user:other-secret@isolated-db.example:5432/nexus_preview';
  assert.throws(() => resolveDatabaseUrl({
    IS_PULL_REQUEST: 'true', DATABASE_URL: PROD, NEXUS_PREVIEW_DATABASE_URL: reused,
  }), /isolation is unverified/);
});

test('production-named service is not treated as a preview', () => {
  assert.equal(resolveDatabaseUrl({
    RENDER_SERVICE_NAME: 'g88-api', IS_PULL_REQUEST: 'false', DATABASE_URL: PROD,
  }), PROD);
});
