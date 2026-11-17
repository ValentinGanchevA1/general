'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { spawnSync } = require('node:child_process');
const { assess } = require('./migration-v17-runtime-role-readiness.cjs');

const fixturePath = path.join(__dirname,'fixtures','v17-redacted-privilege-snapshot.json');
const snapshot = JSON.parse(fs.readFileSync(fixturePath,'utf8'));
const copy = () => JSON.parse(JSON.stringify(snapshot));

test('observed 66-table grants match catalog evidence but remain NO-GO', () => {
  const result = assess(copy());
  assert.equal(result.snapshotMatchesObservedBaseline,true);
  assert.equal(result.runtimeLeastPrivilegeProven,false);
  assert.equal(result.productionReleaseDecision,'NO-GO');
  assert.equal(result.databaseRoleChangeAuthorized,false);
  assert.equal(result.migrationRunnerChangeAuthorized,false);
});

test('unexpected grant to anon fails evidence match', () => {
  const changed=copy();
  changed.rows.find(row=>row.role_name==='anon').select_tables=1;
  assert.equal(assess(changed).snapshotMatchesObservedBaseline,false);
});

test('role omission, duplicate or changed RLS count fails closed', () => {
  const missing=copy(); missing.rows.pop();
  assert.equal(assess(missing).snapshotMatchesObservedBaseline,false);
  const duplicate=copy(); duplicate.rows[0].role_name='postgres';
  assert.equal(assess(duplicate).snapshotMatchesObservedBaseline,false);
  const changed=copy(); changed.rows[0].rls_enabled=2;
  assert.equal(assess(changed).snapshotMatchesObservedBaseline,false);
});

test('claims of complete privilege coverage cannot be accepted', () => {
  const changed=copy(); changed.function_and_view_acl_verified=true;
  assert.equal(assess(changed).snapshotMatchesObservedBaseline,false);
});

test('committed catalog query is read-only with no row data or secrets', () => {
  const query=fs.readFileSync(path.join(__dirname,'../../../docs/qa/NEXUS_G88_V17_RUNTIME_PRIVILEGE_INVENTORY.sql'),'utf8');
  const withoutComments=query.replace(/^--.*$/gm,'').trim();
  assert.match(withoutComments,/^WITH\s/i);
  assert.match(withoutComments,/\bSELECT\b/i);
  assert.doesNotMatch(withoutComments,/\b(?:INSERT|UPDATE|DELETE|ALTER|DROP|CREATE|GRANT|REVOKE|TRUNCATE|COPY|DO|EXECUTE)\s+(?!_tables\b)/i);
  assert.equal((withoutComments.match(/;/g)||[]).length,1);
});

test('CLI always exits 2 without database connectivity', () => {
  const r=spawnSync(process.execPath,[path.join(__dirname,'migration-v17-runtime-role-readiness.cjs'),fixturePath],
    {encoding:'utf8',timeout:5000,env:{}});
  assert.equal(r.status,2);
  assert.equal(JSON.parse(r.stdout).productionReleaseDecision,'NO-GO');
});
