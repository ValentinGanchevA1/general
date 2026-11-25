'use strict';

/**
 * Offline, read-only NEXUS staging target comparison.
 * Does not connect to Postgres/Redis, log credentials, run migrations,
 * or authorize deployment. Always exits 2 if invoked as a CLI.
 */
const { createHash } = require('node:crypto');

const safeHash = (value) => createHash('sha256').update(value).digest('hex').slice(0, 12);

function parseDatabase(input) {
  if (typeof input !== 'string' || input.trim() === '') return null;
  try {
    const url = new URL(input);
    if (!['postgres:', 'postgresql:'].includes(url.protocol)) return null;
    const hostname = url.hostname.toLowerCase().replace(/\.$/, '');
    const port = url.port || '5432';
    const name = decodeURIComponent(url.pathname).replace(/^\//, '');
    const user = decodeURIComponent(url.username);
    if (!hostname || !name || !user || !/^[0-9]+$/.test(port)) return null;
    // Pooler usernames can encode the Supabase project even when endpoints differ.
    const directRef = /^db\.([a-z0-9]{20})\.supabase\.co$/.exec(hostname)?.[1];
    const poolerRef = /(^|\.)pooler\.supabase\.com$/.test(hostname)
      ? /^postgres\.([a-z0-9]{20})$/.exec(user)?.[1]
      : null;
    return { hostname, port, name, user, projectRef: directRef || poolerRef || null };
  } catch {
    return null;
  }
}

function parseRedis(input) {
  if (typeof input !== 'string' || input.trim() === '') return null;
  try {
    const url = new URL(input);
    if (!['redis:', 'rediss:'].includes(url.protocol)) return null;
    const hostname = url.hostname.toLowerCase().replace(/\.$/, '');
    const port = url.port || '6379';
    const database = url.pathname.replace(/^\//, '') || '0';
    if (!hostname || !/^[0-9]+$/.test(port) || !/^\d+$/.test(database)) return null;
    return { hostname, port, database };
  } catch {
    return null;
  }
}

function inspect(env) {
  const prodDb = parseDatabase(env.DATABASE_URL);
  const stagingDb = parseDatabase(env.NEXUS_STAGING_DATABASE_URL);
  const prodRedis = parseRedis(env.REDIS_URL);
  const stagingRedis = parseRedis(env.NEXUS_STAGING_REDIS_URL);
  const checks = {
    production_db_reference_valid: !!prodDb,
    staging_db_reference_valid: !!stagingDb,
    db_host_separate: !!(prodDb && stagingDb && prodDb.hostname !== stagingDb.hostname),
    db_identity_separate: !!(prodDb && stagingDb && (
      prodDb.hostname !== stagingDb.hostname ||
      prodDb.port !== stagingDb.port ||
      prodDb.name !== stagingDb.name
    )),
    db_user_separate: !!(prodDb && stagingDb && prodDb.user !== stagingDb.user),
    supabase_project_separate: !!(prodDb && stagingDb &&
      !(prodDb.projectRef && stagingDb.projectRef && prodDb.projectRef === stagingDb.projectRef)),
    production_redis_reference_valid: !!prodRedis,
    staging_redis_reference_valid: !!stagingRedis,
    redis_host_separate: !!(prodRedis && stagingRedis && prodRedis.hostname !== stagingRedis.hostname),
    redis_identity_separate: !!(prodRedis && stagingRedis && (
      prodRedis.hostname !== stagingRedis.hostname ||
      prodRedis.port !== stagingRedis.port ||
      prodRedis.database !== stagingRedis.database
    )),
  };
  const offlineChecksPass = Object.values(checks).every(Boolean);
  return {
    status: offlineChecksPass ? 'OFFLINE_CHECKS_PASS_NOT_AUTHORIZED' : 'BLOCKED',
    checks,
    // Fingerprints support reviewer comparison without printing host/user/db.
    fingerprint: stagingDb ? safeHash(
      [stagingDb.hostname, stagingDb.port, stagingDb.name, stagingDb.user].join('|')
    ) : null,
    disclaimer: 'Offline comparison only; cannot prove network, DNS, data-plane, credentials or migration isolation.',
  };
}

if (require.main === module) {
  try {
    const result = inspect(process.env);
    process.stdout.write(JSON.stringify(result, null, 2) + '\n');
    process.stderr.write('Deployment and migrations remain blocked pending independent staging sign-off.\n');
  } catch {
    process.stderr.write('Staging offline audit unavailable; deployment remains blocked.\n');
  }
  process.exitCode = 2;
}

module.exports = { inspect, parseDatabase, parseRedis };
