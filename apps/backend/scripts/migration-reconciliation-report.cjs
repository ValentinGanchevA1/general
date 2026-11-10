'use strict';

// OFFLINE evidence classifier only. Never import migrate.js or a database client.
// This inventory MUST NOT be used as a production migration allowlist.
const fs = require('node:fs');
const path = require('node:path');

const BASELINE_SHA = '3e533639488ab0fb81a1728f308e77242637eb9f';
const FILENAME_PATTERN = /^\d{4}_[a-z0-9_]+\.sql$/;

// Classification is descriptive, NOT an assertion that SQL ran safely.
// Older 0036/0037/0038 source bodies match current versions apart from
// filename comments; actual deployed SQL/checksums still require validation.
const HISTORICAL = Object.freeze({
  '0036_trade_offer_counter.sql': { kind: 'historical-rename', successor: '0040_trade_offer_counter.sql', source: 'a3f8c2dd / b89e6b37' },
  '0037_conversation_kind_members.sql': { kind: 'historical-rename', successor: '0038_conversation_kind_members.sql', source: 'a3f8c2dd / cf5858c5' },
  '0038_user_strikes.sql': { kind: 'historical-rename', successor: '0039_user_strikes.sql', source: 'a3f8c2dd / 12c672b4' },
  '0051_event_reviews.sql': { kind: 'historical-source-unverified', successor: '0052_event_reviews.sql', source: '#823 is current replacement candidate' },
  '0054_posthog_deletion_queue.sql': { kind: 'historical-source-unverified', successor: '0062_posthog_deletion_queue.sql', source: '#829 is current replacement candidate' },
  '0069_realtime_room_revocation_outbox.sql': { kind: 'unmerged-feature-migration', source: 'draft PR #1060 / #1055' },
  '0072_extend_content_report_targets.sql': { kind: 'unmerged-feature-migration', source: 'PR #1066 historical fb79c8fe' },
  '0072_personal_labels.sql': { kind: 'unmerged-feature-migration', source: 'draft PR #1074' },
  '0072_ugc_terms_acceptance.sql': { kind: 'unmerged-feature-migration', source: 'draft PR #1066 / #1067' },
  '0073_event_question_moderation.sql': { kind: 'unmerged-feature-migration', source: 'PR #1066 historical fb79c8fe' },
  '0073_extend_content_report_targets.sql': { kind: 'unmerged-feature-migration', source: 'draft PR #1066, renamed' },
  '0074_event_question_moderation.sql': { kind: 'unmerged-feature-migration', source: 'draft PR #1066, renamed' },
  '0075_dating_match_conversation_lookup.sql': { kind: 'unmerged-feature-migration', source: 'draft PR #1066' },
  '0076_child_safety_report_reason.sql': { kind: 'unmerged-feature-migration', source: 'draft PR #1066' },
  '0077_adult_only_rc1_visibility.sql': { kind: 'unmerged-feature-migration', source: 'draft PR #1066: retain adult privacy invariant' },
});

function validateFileNames(names, label) {
  if (!Array.isArray(names)) throw new TypeError(label + ' must be an array');
  const seen = new Set();
  for (const filename of names) {
    if (typeof filename !== 'string' || !FILENAME_PATTERN.test(filename)) {
      throw new Error(label + ' contains an invalid migration filename');
    }
    if (seen.has(filename)) throw new Error(label + ' contains a duplicate filename');
    seen.add(filename);
  }
  return seen;
}

function readOwnerSnapshot(filePath) {
  const rows = fs.readFileSync(filePath, 'utf8')
    .split(/\r?\n/)
    .map((row) => row.trim())
    .filter((row) => row && !row.startsWith('#'));
  validateFileNames(rows, 'owner snapshot');
  return rows;
}

function auditMigrationHistory(appliedFiles, localFiles) {
  const applied = validateFileNames(appliedFiles, 'applied history');
  const local = validateFileNames(localFiles, 'local checkout');
  const missingFromCheckout = [...applied]
    .filter((name) => !local.has(name))
    .sort((a, b) => a.localeCompare(b))
    .map((filename) => ({
      filename,
      kind: HISTORICAL[filename]?.kind ?? 'UNKNOWN_UNRECOGNIZED',
      source: HISTORICAL[filename]?.source ?? null,
      successor: HISTORICAL[filename]?.successor ?? null,
      successorRecorded: HISTORICAL[filename]?.successor
        ? applied.has(HISTORICAL[filename].successor)
        : null,
    }));
  const notAppliedOnSnapshot = [...local].filter((name) => !applied.has(name)).sort((a, b) => a.localeCompare(b));
  const expectedNames = Object.keys(HISTORICAL).sort((a, b) => a.localeCompare(b));
  const observedNames = missingFromCheckout.map((item) => item.filename);
  const matchesOwnerSnapshot =
    applied.size === 85 &&
    local.size === 70 &&
    notAppliedOnSnapshot.length === 0 &&
    JSON.stringify(expectedNames) === JSON.stringify(observedNames);

  const prefixes = new Map();
  for (const filename of applied) {
    const prefix = filename.slice(0, 4);
    prefixes.set(prefix, (prefixes.get(prefix) ?? 0) + 1);
  }
  const duplicatePrefixes = [...prefixes].filter(([, count]) => count > 1)
    .map(([prefix]) => prefix).sort((a, b) => a.localeCompare(b));

  return {
    baselineCommit: BASELINE_SHA,
    source: 'Owner-supplied filename snapshot, DB target identity NOT attested',
    appliedCount: applied.size,
    checkoutCount: local.size,
    missingFromCheckout,
    missingFromCheckoutCount: missingFromCheckout.length,
    checkoutFilesNotRecorded: notAppliedOnSnapshot,
    duplicatePrefixes,
    matchesOwnerSnapshot,
    // An exact filename match is only evidence of a known risk, never an approval.
    disposition: 'BLOCKED_RECONCILIATION_REVIEW_REQUIRED',
    // Scope of THIS offline report, not an assertion about any external system.
    auditReadsDatabase: false,
  };
}

if (require.main === module) {
  try {
    const dir = path.join(__dirname, '..', 'migrations');
    const fixture = path.join(__dirname, 'fixtures', 'migration-history-owner-20261110.txt');
    const report = auditMigrationHistory(
      readOwnerSnapshot(fixture),
      fs.readdirSync(dir).filter((file) => file.endsWith('.sql')),
    );
    process.stdout.write(JSON.stringify(report, null, 2) + '\n');
    // Nonzero is intentional: a snapshot, even when matched exactly, is NOT a release approval.
    process.exitCode = 2;
  } catch {
    // Avoid printing paths, environment variables, database URLs, or raw input.
    process.stderr.write('Migration inventory invalid; release blocked.\n');
    process.exitCode = 1;
  }
}

module.exports = { auditMigrationHistory, readOwnerSnapshot, HISTORICAL, BASELINE_SHA };
