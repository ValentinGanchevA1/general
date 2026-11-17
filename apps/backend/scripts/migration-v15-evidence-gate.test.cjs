'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { spawnSync } = require('node:child_process');
const { auditV15 } = require('./migration-v15-evidence-gate.cjs');
const { assertMigrationHistoryCompatible } = require('./migration-history-guard');

const repositoryRoot = path.join(__dirname, '..', '..', '..');
const manifest = JSON.parse(fs.readFileSync(path.join(repositoryRoot,
  'docs/qa/NEXUS_G88_15_SQL_SOURCE_CANDIDATES_2026-11-11.json'), 'utf8'));
const fixture = fs.readFileSync(path.join(__dirname,'fixtures','migration-history-owner-20261110.txt'),'utf8')
  .split(/\r?\n/).map((s)=>s.trim()).filter((s)=>s && !s.startsWith('#'));
const local = fs.readdirSync(path.join(__dirname,'..','migrations')).filter((s)=>s.endsWith('.sql'));
const sample = JSON.parse(fs.readFileSync(path.join(__dirname,'fixtures','v15-redacted-evidence.json'),'utf8'));
const containment = JSON.parse(fs.readFileSync(path.join(__dirname,'fixtures','v15-containment-observed.json'),'utf8'));
const input = (evidence=sample, cfg=containment, names=fixture) => ({
  evidence, containment:cfg, trackerFiles:names, masterFiles:local, sourceManifest:manifest,
});

test('v14 report provides 70/15/85 evidence but cannot grant production release',()=>{
  const r=auditV15(input());
  assert.equal(r.baselineEvidenceMatches,true);
  assert.equal(r.guardMustRemainFailClosed,true);
  assert.equal(r.migrationRunnerAuthorization,false);
  assert.equal(r.releaseDecision,'NO-GO');
  assert.equal(r.sourceExecutionAttested,false);
});

test('observed Render preview auto-deploy and shared database fail containment',()=>{
  const r=auditV15(input());
  assert.equal(r.previewControlsVerified,false);
  assert.equal(r.databaseIsolationProven,false);
  assert.equal(r.productionCredentialsStillShared,true);
  assert.ok(r.blockers.includes('PRODUCTION_DB_CREDENTIALS_SHARED_WITH_PREVIEWS'));
});

test('even both auto-deploy OFF and distinct DB do not approve executed-SQL provenance',()=>{
  const safe=JSON.parse(JSON.stringify(containment));
  for(const p of safe.previews){p.autoDeploy='no';p.productionDatabaseConfigurationSame=false;p.databaseIsolationVerified=true;}
  const r=auditV15(input(sample,safe));
  assert.equal(r.previewControlsVerified,true);
  assert.equal(r.databaseIsolationProven,true);
  assert.equal(r.migrationRunnerAuthorization,false);
  assert.equal(r.releaseDecision,'NO-GO');
});

test('unrecognized 16th migration is rejected as baseline mismatch',()=>{
  const r=auditV15(input(sample,containment,[...fixture,'0099_unknown_draft.sql']));
  assert.equal(r.baselineEvidenceMatches,false);
  assert.ok(r.blockers.includes('OFFLINE_BASELINE_MISMATCH'));
  assert.equal(r.releaseDecision,'NO-GO');
});

test('tampered timestamp names or altered core schema count fail closed',()=>{
  const altered=JSON.parse(JSON.stringify(sample));
  altered.migration_chronology_v14.rows[0].filename='0099_bad.sql';
  assert.equal(auditV15(input(altered)).baselineEvidenceMatches,false);
  const changed=JSON.parse(JSON.stringify(sample));
  changed.schema_effects_v13.present_catalog_checks=42;
  assert.equal(auditV15(input(changed)).baselineEvidenceMatches,false);
});

function fakeClient(names){const queries=[];return {
 queries,
 async query(sql){queries.push(String(sql));
  if(String(sql).includes("to_regclass('public.schema_migrations')"))return {rows:[{tracker_table:'public.schema_migrations'}]};
  if(String(sql).startsWith('SELECT filename FROM public.schema_migrations'))return {rows:names.map(filename=>({filename}))};
  throw new Error('unexpected DB query (possibly mutating)');
 },
};}

test('actual migration guard still rejects all 15 historic names BEFORE writes',async()=>{
  const db=fakeClient(fixture);
  await assert.rejects(assertMigrationHistoryCompatible(db,local,[]),
    e=>e.code==='MIGRATION_HISTORY_DRIFT' && /15 applied/.test(e.message));
  assert.equal(db.queries.length,2);
  assert.ok(db.queries.every(q=>q.startsWith('SELECT')));
});

test('actual migration guard rejects a 16th unknown filename BEFORE writes',async()=>{
  const db=fakeClient([...fixture,'0099_unknown_draft.sql']);
  await assert.rejects(assertMigrationHistoryCompatible(db,local,[]),
    e=>e.code==='MIGRATION_HISTORY_DRIFT' && /16 applied/.test(e.message));
  assert.equal(db.queries.length,2);
  assert.ok(db.queries.every(q=>q.startsWith('SELECT')));
});

test('offline CLI intentionally exits 2 even on matching baseline',()=>{
  const p=path.join(__dirname,'fixtures','v15-redacted-evidence.json');
  const c=path.join(__dirname,'fixtures','v15-containment-observed.json');
  const run=spawnSync(process.execPath,[path.join(__dirname,'migration-v15-evidence-gate.cjs'),p,c],
    {encoding:'utf8',timeout:6000,env:{}});
  assert.equal(run.status,2);
  assert.equal(run.stderr,'');
  const report=JSON.parse(run.stdout);
  assert.equal(report.releaseDecision,'NO-GO');
  assert.equal(report.migrationRunnerAuthorization,false);
});
