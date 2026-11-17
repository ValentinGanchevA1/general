'use strict';

// NEXUS G88 v17 -- offline, fail-closed summary of a REDACTED catalog snapshot.
// Never opens database/network connections or authorizes a migration/release.
const fs = require('node:fs');
const path = require('node:path');

const ROLES = Object.freeze(['anon', 'authenticated', 'postgres', 'service_role']);
const FIELDS = Object.freeze([
  'public_tables', 'rls_enabled', 'rls_forced', 'owned_by_postgres',
  'select_tables', 'insert_tables', 'update_tables', 'delete_tables',
]);

function assess(snapshot) {
  const rows = snapshot?.rows;
  const valid = Array.isArray(rows) && rows.length === ROLES.length &&
    ROLES.every(name => rows.filter(row => row?.role_name === name).length === 1) &&
    rows.every(row => FIELDS.every(field =>
      Number.isSafeInteger(Number(row[field])) &&
      Number(row[field]) >= 0 &&
      Number(row[field]) <= Number(row.public_tables))) &&
    rows.every(row => Number(row.public_tables) === 66 &&
      Number(row.rls_enabled) === 1 &&
      Number(row.rls_forced) === 0 &&
      Number(row.owned_by_postgres) === 66) &&
    ['anon', 'authenticated'].every(name => {
      const row = rows.find(item => item.role_name === name);
      return ['select_tables','insert_tables','update_tables','delete_tables']
        .every(field => Number(row[field]) === 0);
    }) &&
    ['postgres','service_role'].every(name => {
      const row = rows.find(item => item.role_name === name);
      return ['select_tables','insert_tables','update_tables','delete_tables']
        .every(field => Number(row[field]) === 66);
    }) &&
    snapshot.scope === 'public regular/partitioned tables only' &&
    snapshot.data_api_exposure_verified === false &&
    snapshot.function_and_view_acl_verified === false &&
    snapshot.application_role_tested === false &&
    snapshot.production_build_migration_run_present === true;

  return {
    mode: 'OFFLINE_CATALOG_DIAGNOSTIC',
    snapshotMatchesObservedBaseline: Boolean(valid),
    runtimeLeastPrivilegeProven: false,
    databaseRoleChangeAuthorized: false,
    migrationRunnerChangeAuthorized: false,
    productionReleaseDecision: 'NO-GO',
    blockers: [
      ...(valid ? [] : ['CATALOG_SNAPSHOT_INVALID_OR_CHANGED']),
      'FUNCTION_VIEW_SEQUENCE_PRIVILEGES_NOT_ATTESTED',
      'BACKEND_RUNTIME_ROLE_UNTESTED',
      'PRODUCTION_BUILD_STILL_RUNS_MIGRATIONS',
      'MIGRATION_HISTORY_DRIFT_UNRESOLVED',
      'CREDENTIAL_ROTATION_NOT_APPROVED',
    ],
  };
}

function main() {
  const pathArg = process.argv[2] || path.join(__dirname, 'fixtures', 'v17-redacted-privilege-snapshot.json');
  try {
    const result = assess(JSON.parse(fs.readFileSync(pathArg, 'utf8')));
    process.stdout.write(JSON.stringify(result, null, 2) + '\n');
  } catch {
    process.stderr.write('Invalid offline evidence (details redacted). NO-GO.\n');
  }
  process.exitCode = 2;
}

if (require.main === module) main();
module.exports = { assess };
