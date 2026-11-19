'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const { inspect, parseDatabase, parseRedis } = require('./staging-isolation-preflight.cjs');

const settings = {
  DATABASE_URL: 'postgresql://prod@prod-db.invalid/main',
  NEXUS_STAGING_DATABASE_URL: 'postgresql://stage@stage-db.invalid/stage',
  REDIS_URL: 'redis://prod-cache.invalid:6379/0',
  NEXUS_STAGING_REDIS_URL: 'redis://stage-cache.invalid:6379/0',
};

test('offline distinct targets are not deployment authorization', () => {
  const result = inspect(settings);
  assert.equal(result.status, 'OFFLINE_CHECKS_PASS_NOT_AUTHORIZED');
  assert.equal(Object.values(result.checks).every(Boolean), true);
  assert.match(result.fingerprint, /^[a-f0-9]{12}$/);
});

test('missing staging dependencies block readiness', () => {
  for (const key of ['NEXUS_STAGING_DATABASE_URL', 'NEXUS_STAGING_REDIS_URL']) {
    assert.equal(inspect({ ...settings, [key]: '' }).status, 'BLOCKED');
  }
});

test('database on production host blocks readiness, even with distinct database', () => {
  const result = inspect({
    ...settings, NEXUS_STAGING_DATABASE_URL: 'postgresql://stage@prod-db.invalid/stage',
  });
  assert.equal(result.checks.db_host_separate, false);
  assert.equal(result.status, 'BLOCKED');
});

test('staging must use distinct database role', () => {
  const result = inspect({
    ...settings, NEXUS_STAGING_DATABASE_URL: 'postgresql://prod@stage-db.invalid/stage',
  });
  assert.equal(result.checks.db_user_separate, false);
  assert.equal(result.status, 'BLOCKED');
});

test('Redis logical DB alone is not isolation', () => {
  const result = inspect({
    ...settings, NEXUS_STAGING_REDIS_URL: 'redis://prod-cache.invalid:6379/1',
  });
  assert.equal(result.checks.redis_host_separate, false);
  assert.equal(result.status, 'BLOCKED');
});

test('same Supabase project via different endpoints is rejected', () => {
  const ref = 'abcdefghijklmnopqrst';
  const result = inspect({
    ...settings,
    DATABASE_URL: `postgresql://postgres@db.${ref}.supabase.co/postgres`,
    NEXUS_STAGING_DATABASE_URL: `postgresql://postgres.${ref}@aws-0-eu-central-1.pooler.supabase.com:6543/stage`,
  });
  assert.equal(result.checks.supabase_project_separate, false);
  assert.equal(result.status, 'BLOCKED');
});

test('parsers reject unrelated protocols and malformed values', () => {
  assert.equal(parseDatabase('https://example.invalid'), null);
  assert.equal(parseRedis('https://example.invalid'), null);
  assert.equal(parseDatabase('not a url'), null);
});
