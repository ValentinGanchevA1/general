'use strict';

/**
 * Read-only provenance probe to run with the SAME DATABASE_URL as a Render
 * service (e.g. from a controlled Render Shell/isolated staging session).
 * No migration runner import, no schema writes, no password/URL printing.
 *
 * IMPORTANT: even a perfect filename match is not permission to deploy.
 * The CLI ALWAYS returns exit code 2 so automation remains release-blocked.
 */
const { createHash } = require('node:crypto');
const path = require('node:path');
const { Client } = require('pg');
const { readOwnerSnapshot } = require('./migration-reconciliation-report.cjs');

const FIXTURE = path.join(__dirname, 'fixtures', 'migration-history-owner-20261110.txt');

function describeTarget(rawUrl) {
  if (!rawUrl || typeof rawUrl !== 'string') throw new Error('DATABASE_URL is unavailable');
  let url;
  try { url = new URL(rawUrl); } catch { throw new Error('Invalid DATABASE_URL (redacted)'); }
  if (!['postgres:', 'postgresql:'].includes(url.protocol) || !url.hostname ||
      !url.pathname || url.pathname === '/') {
    throw new Error('DATABASE_URL target is not a PostgreSQL database (redacted)');
  }
  try {
    const host = url.hostname.toLowerCase();
    const port = url.port || '5432';
    const database = decodeURIComponent(url.pathname.slice(1));
    const user = decodeURIComponent(url.username);
    if (!user || !database || !/^\d{2,5}$/.test(port)) {
      throw new Error('Invalid database identity');
    }
    // This digest excludes password and URI query parameters entirely.
    const identityDigest = createHash('sha256')
      .update([host, port, database, user].join('\0')).digest('hex');
    return { host, port: Number(port), database, user, identityDigest };
  } catch {
    throw new Error('Invalid DATABASE_URL target identity (redacted)');
  }
}

async function inspectReadOnly(client, expectedNames) {
  const applied = [];
  let serverIdentity;
  let readOnly = false;
  await client.query('BEGIN TRANSACTION ISOLATION LEVEL REPEATABLE READ READ ONLY');
  try {
    const identity = await client.query(
      'SELECT current_database() AS db, current_user AS role, ' +
      'current_setting(\'transaction_read_only\') AS read_only',
    );
    const row = identity.rows[0];
    readOnly = row?.read_only === 'on';
    if (!readOnly) throw new Error('PostgreSQL transaction is not read-only');
    serverIdentity = { database: row.db, databaseUser: row.role };
    const res = await client.query(
      'SELECT filename FROM public.schema_migrations ORDER BY filename ASC',
    );
    for (const entry of res.rows) {
      if (typeof entry.filename !== 'string') {
        throw new Error('Invalid migration metadata');
      }
      applied.push(entry.filename);
    }
  } finally {
    // READ ONLY + ROLLBACK; never stamp, update or replay history.
    await client.query('ROLLBACK');
  }
  const observed = new Set(applied);
  const expected = new Set(expectedNames);
  const snapshotMatch = observed.size === expected.size &&
    applied.length === expected.size &&
    [...observed].every((filename) => expected.has(filename));
  return {
    serverIdentity,
    transactionReadOnly: readOnly,
    appliedCount: applied.length,
    expectedCount: expected.size,
    snapshotMatch,
    // History matching this snapshot is evidence, never authorization.
    disposition: 'BLOCKED_PENDING_SOURCE_PROVENANCE_AND_STAGING_RESTORE',
  };
}

async function main() {
  let client;
  try {
    const target = describeTarget(process.env.DATABASE_URL);
    client = new Client({
      connectionString: process.env.DATABASE_URL,
      connectionTimeoutMillis: 8_000,
      query_timeout: 10_000,
    });
    await client.connect();
    const inventory = await inspectReadOnly(client, readOwnerSnapshot(FIXTURE));
    process.stdout.write(JSON.stringify({ target, inventory }, null, 2) + '\n');
  } catch {
    // Pg connection errors can include credentials/host: never echo err.
    process.stderr.write('Database target audit unavailable (details redacted); still blocked.\n');
  } finally {
    if (client) await client.end().catch(() => undefined);
    // The CLI is deliberately not an approval gate and never returns success.
    process.exitCode = 2;
  }
}

if (require.main === module) void main();
module.exports = { describeTarget, inspectReadOnly };
