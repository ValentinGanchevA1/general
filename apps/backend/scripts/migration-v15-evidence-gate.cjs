'use strict';

/**
 * NEXUS G88 v15 — OFFLINE evidence gate only.
 * Intentionally cannot approve production or authorize migration runner.
 * No DB, network, shell, environment variables, or SQL execution.
 */
const fs = require('node:fs');
const path = require('node:path');

const PINNED_MASTER_SHA = 'ee1bcbc790704d53b3586148c56066ae72baeb97';
const ARCHIVE_SHA256 = '1D15E6909163D27F35EE087587F64231FAA2E46A9D6319FC25630A3C571C3D65';
const NAME_PATTERN = /^\d{4}_[a-z0-9_]+\.sql$/;
const EXPECTED_PREVIEW_NAMES = Object.freeze(['g88-api PR #1055', 'g88-api PR #1074']);

function exactSet(left, right) {
  return Array.isArray(left) && Array.isArray(right) && left.length === right.length &&
    new Set(left).size === left.length && new Set(right).size === right.length &&
    left.every((name) => right.includes(name));
}

function validNameList(names) {
  return Array.isArray(names) && names.every((name) =>
    typeof name === 'string' && NAME_PATTERN.test(name)) && new Set(names).size === names.length;
}

function auditV15({ evidence, sourceManifest, masterFiles, trackerFiles, containment }) {
  // Do not reveal PII or raw imported data in output.
  const candidateNames = sourceManifest?.entries?.map((entry) => entry.filename);
  const timeline = evidence?.migration_chronology_v14?.rows;
  const timelineNames = timeline?.map((entry) => entry.filename);
  const fieldsOk = validNameList(candidateNames) && candidateNames.length === 15 &&
    sourceManifest.entries.every((row) => /^[0-9a-f]{40}$/.test((row.sourceGitBlob ?? row.git_blob_sha1))) &&
    validNameList(masterFiles) && masterFiles.length === 70 &&
    validNameList(trackerFiles) && trackerFiles.length === 85;
  const baselineOk = fieldsOk &&
    evidence?.scope === 'public schema ONLY: not full Supabase disaster recovery' &&
    evidence?.archive_sha256 === ARCHIVE_SHA256 &&
    evidence?.source_g88_contacted === false &&
    evidence?.existing_nexus_containers_volumes_modified === false &&
    exactSet(evidence?.restore_sections_pass, ['pre-data', 'data', 'post-data']) &&
    evidence?.migration_filename_set_matches_85_snapshot === true &&
    evidence?.migration_sql_execution_attested === false &&
    evidence?.migration_reconciliation?.pinned_master_sha === PINNED_MASTER_SHA &&
    evidence?.migration_reconciliation?.master_sql_filenames === 70 &&
    evidence?.migration_reconciliation?.restored_tracker_filenames === 85 &&
    evidence?.migration_reconciliation?.known_master_files_already_tracked === 70 &&
    evidence?.migration_reconciliation?.master_sql_files_pending === 0 &&
    evidence?.migration_reconciliation?.historical_extra_filenames === 15 &&
    evidence?.migration_reconciliation?.schema_migrations_changed === false &&
    evidence?.migration_reconciliation?.migration_runner_executed === false &&
    evidence?.migration_reconciliation?.production_compatibility_approved === false &&
    evidence?.schema_effects_v13?.present_catalog_checks === 43 &&
    evidence?.schema_effects_v13?.unique_catalog_checks === 43 &&
    evidence?.schema_effects_v13?.semantic_marker_checks === 7 &&
    Array.isArray(evidence?.schema_effects_v13?.semantic_marker_failures) &&
    evidence.schema_effects_v13.semantic_marker_failures.length === 0 &&
    evidence?.schema_effects_v13?.data_only_current_eligibility_rule_unreconciled_rows === 0 &&
    evidence?.migration_chronology_v14?.scope === 'RESTORED_ARCHIVE_ONLY' &&
    evidence?.migration_chronology_v14?.record_count === 15 &&
    Array.isArray(timeline) && timeline.length === 15 &&
    timeline.every((row) => row && typeof row.applied_at_utc === 'string' &&
      !Number.isNaN(Date.parse(row.applied_at_utc))) &&
    exactSet(timelineNames, candidateNames) &&
    exactSet(masterFiles.concat(candidateNames), trackerFiles) &&
    evidence?.counts?.tables === 66 && evidence?.counts?.migration_rows === 85;

  const previewRows = containment?.previews;
  const previewNamesOk = Array.isArray(previewRows) &&
    exactSet(previewRows.map((row) => row.name), EXPECTED_PREVIEW_NAMES);
  const containmentControlsOk =
    containment?.productionPreviewGeneration === 'off' && previewNamesOk &&
    previewRows.every((row) => row.suspended === true && row.autoDeploy === 'no');
  const databaseIsolationProven = previewNamesOk &&
    previewRows.every((row) => row.productionDatabaseConfigurationSame === false &&
      row.databaseIsolationVerified === true);
  const remainingSharedCredentials = previewNamesOk &&
    previewRows.some((row) => row.productionDatabaseConfigurationSame === true);

  // A successful offline match remains BLOCKED: executed SQL bytes are unattested,
  // database credential separation and full disaster recovery are not established.
  return Object.freeze({
    mode: 'OFFLINE_DIAGNOSTIC_ONLY',
    pinnedMasterSha: PINNED_MASTER_SHA,
    knownHistoricalCandidateCount: candidateNames?.length ?? null,
    baselineEvidenceMatches: Boolean(baselineOk),
    sourceExecutionAttested: false,
    previewControlsVerified: Boolean(containmentControlsOk),
    databaseIsolationProven: Boolean(databaseIsolationProven),
    productionCredentialsStillShared: Boolean(remainingSharedCredentials),
    guardMustRemainFailClosed: true,
    migrationRunnerAuthorization: false,
    releaseDecision: 'NO-GO',
    blockers: [
      ...(baselineOk ? [] : ['OFFLINE_BASELINE_MISMATCH']),
      ...(containmentControlsOk ? [] : ['PREVIEW_CONTROLS_NOT_INDEPENDENTLY_VERIFIED']),
      ...(databaseIsolationProven ? [] : ['PREVIEW_DATABASE_ISOLATION_NOT_ATTESTED']),
      ...(remainingSharedCredentials ? ['PRODUCTION_DB_CREDENTIALS_SHARED_WITH_PREVIEWS'] : []),
      'EXECUTED_SQL_PROVENANCE_NOT_ATTESTED',
      'FULL_SUPABASE_AND_S3_RECOVERY_NOT_ATTESTED',
    ],
  });
}

function readFixture(filePath) {
  return fs.readFileSync(filePath, 'utf8').split(/\r?\n/)
    .map((name) => name.trim()).filter((name) => name && !name.startsWith('#'));
}

function main() {
  const [evidencePath, containmentPath] = process.argv.slice(2);
  if (!evidencePath) {
    process.stderr.write('Usage: node migration-v15-evidence-gate.cjs <v14-json-file> [containment-json-file]\n');
    process.exitCode = 1;
    return;
  }
  try {
    const evidence = JSON.parse(fs.readFileSync(evidencePath, 'utf8'));
    const containment = containmentPath ? JSON.parse(fs.readFileSync(containmentPath, 'utf8')) : null;
    const scriptsDir = __dirname;
    const repoRoot = path.join(scriptsDir, '..', '..', '..');
    const sourceManifest = JSON.parse(fs.readFileSync(path.join(
      repoRoot, 'docs', 'qa', 'NEXUS_G88_15_SQL_SOURCE_CANDIDATES_2026-11-11.json'), 'utf8'));
    const masterFiles = fs.readdirSync(path.join(scriptsDir, '..', 'migrations'))
      .filter((name) => name.endsWith('.sql'));
    const trackerFiles = readFixture(path.join(scriptsDir, 'fixtures', 'migration-history-owner-20261110.txt'));
    const result = auditV15({evidence, sourceManifest, masterFiles, trackerFiles, containment});
    process.stdout.write(JSON.stringify(result, null, 2) + '\n');
    // Non-zero intentionally. This tool is never a sign-off or allowlist.
    process.exitCode = 2;
  } catch {
    process.stderr.write('Invalid or unreadable evidence. NO-GO. No information was modified.\n');
    process.exitCode = 1;
  }
}

if (require.main === module) main();
module.exports = {auditV15};
