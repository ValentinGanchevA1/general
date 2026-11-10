'use strict';

/**
 * Non-mutating OFFLINE destination preflight.
 * No PostgreSQL network, raw URL logging, backups or restore.
 * The CLI always exits 2: this is evidence, never deployment authorization.
 */
const { createHash } = require('node:crypto');

const REF_PATTERN = /^[a-z0-9]{20}$/;

function projectRefFromTarget(url) {
  const host = url.hostname.toLowerCase();
  const direct = /^db\.([a-z0-9]{20})\.supabase\.co$/.exec(host);
  if (direct) return direct[1];
  if (/(^|\.)pooler\.supabase\.com$/.test(host)) {
    const pooler = /^postgres\.([a-z0-9]{20})$/.exec(decodeURIComponent(url.username));
    if (pooler) return pooler[1];
  }
  return null;
}

function describe(urlString) {
  if (typeof urlString !== 'string' || !urlString) throw new Error('Database URL missing (redacted)');
  let url;
  try { url = new URL(urlString); } catch { throw new Error('Malformed database URL (redacted)'); }
  if (!['postgres:', 'postgresql:'].includes(url.protocol) || !url.hostname ||
      !url.username || !url.pathname || url.pathname === '/' || url.hash) {
    throw new Error('Incomplete database destination (redacted)');
  }
  const port = url.port || '5432';
  if (!/^\d{1,5}$/.test(port) || Number(port) < 1 || Number(port) > 65535) {
    throw new Error('Invalid PostgreSQL port (redacted)');
  }
  const db = decodeURIComponent(url.pathname.slice(1));
  const user = decodeURIComponent(url.username);
  if (!db || !user || db.includes('/') || user.includes('/')) {
    throw new Error('Invalid database/user (redacted)');
  }
  const host = url.hostname.toLowerCase();
  const identityHash = createHash('sha256')
    .update([host, port, db, user].join('\0')).digest('hex');
  return { host, port: Number(port), db, user, projectRef: projectRefFromTarget(url), identityHash };
}

function preflight(sourceUrl, stagingUrl, options = {}) {
  const source = describe(sourceUrl);
  const target = describe(stagingUrl);
  const issues = [];
  const expectedSource = options.expectedSourceRef;
  const expectedStaging = options.expectedStagingRef;

  if (!REF_PATTERN.test(expectedSource || '') || source.projectRef !== expectedSource) {
    issues.push('Source Supabase project identity cannot be independently matched');
  }
  if (!REF_PATTERN.test(expectedStaging || '') || target.projectRef !== expectedStaging) {
    issues.push('Staging project identity cannot be independently matched');
  }
  if (source.projectRef && source.projectRef === target.projectRef) {
    issues.push('Source and target point to the same Supabase project');
  }
  if (expectedSource && expectedStaging && expectedSource === expectedStaging) {
    issues.push('Expected source and staging project references must differ');
  }
  if (source.identityHash === target.identityHash) {
    issues.push('Source and staging database destinations are identical');
  }
  if (options.stagingIsolationAcknowledged !== 'YES') {
    issues.push('Staging isolation (Redis, push, OAuth, jobs) is not acknowledged');
  }
  if (options.backupVerified !== 'YES') {
    issues.push('Restorable encrypted backup has not been independently verified');
  }

  return {
    sourceProjectRef: source.projectRef,
    stagingProjectRef: target.projectRef,
    sourceIdentityHash: source.identityHash,
    stagingIdentityHash: target.identityHash,
    checksPassed: issues.length === 0,
    issues,
    disposition: 'EVIDENCE_ONLY_NOT_RESTORE_AUTHORIZATION',
  };
}

function main() {
  try {
    const report = preflight(
      process.env.NEXUS_SOURCE_DATABASE_URL,
      process.env.NEXUS_STAGING_DATABASE_URL,
      {
        expectedSourceRef: process.env.NEXUS_SOURCE_PROJECT_REF,
        expectedStagingRef: process.env.NEXUS_STAGING_PROJECT_REF,
        stagingIsolationAcknowledged: process.env.NEXUS_STAGING_ISOLATION_ACK,
        backupVerified: process.env.NEXUS_RESTORABLE_BACKUP_ACK,
      },
    );
    process.stdout.write(JSON.stringify(report, null, 2) + '\n');
  } catch {
    process.stderr.write('Staging target preflight unavailable (details redacted).\n');
  } finally {
    process.exitCode = 2;
  }
}

if (require.main === module) main();
module.exports = { describe, preflight };
