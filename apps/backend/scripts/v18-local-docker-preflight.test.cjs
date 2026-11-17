'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const { spawnSync } = require('node:child_process');
const path = require('node:path');
const { assess, inspectDocker, INSPECTION_FORMATS } = require('./v18-local-docker-preflight.cjs');

const CONTAINER = 'supabase_db_nexus-g88-staging';
const IMAGE = 'public.ecr.aws/supabase/postgres:17.6.1.121';
const PORTS = { '5432/tcp': [{ HostIp: '127.0.0.1', HostPort: '54322' }] };
const check = (running = true, image = IMAGE, ports = PORTS) =>
  assess(CONTAINER, running, image, ports);

test('expected Docker shape is only diagnostic, never an authorization', () => {
  const result = check();
  assert.equal(result.metadataMatchesExpectedShape, true);
  assert.equal(result.productionTargetExclusionProven, false);
  assert.equal(result.stagingConnectionOrRestoreAuthorized, false);
  assert.equal(result.productionReleaseDecision, 'NO-GO');
  assert.ok(result.issues.includes('DATABASE_IDENTITY_NOT_ATTESTED_BY_CONNECTION'));
});

test('rejects externally published PostgreSQL port and port drift', () => {
  for (const host of ['0.0.0.0', '::', '::1', '127.0.0.2', '']) {
    assert.equal(check(true, IMAGE, { '5432/tcp': [{ HostIp: host, HostPort: '54322' }] })
      .metadataMatchesExpectedShape, false);
  }
  assert.equal(check(true, IMAGE, { '5432/tcp': [{ HostIp: '127.0.0.1', HostPort: '5432' }] })
    .metadataMatchesExpectedShape, false);
});

test('rejects multiple PostgreSQL bindings and unexpected published ports', () => {
  assert.equal(check(true, IMAGE, { '5432/tcp': [...PORTS['5432/tcp'], { HostIp: '0.0.0.0', HostPort: '5432' }] })
    .metadataMatchesExpectedShape, false);
  assert.equal(check(true, IMAGE, { ...PORTS, '8000/tcp': [{ HostIp: '127.0.0.1', HostPort: '8000' }] })
    .metadataMatchesExpectedShape, false);
  assert.equal(check(true, IMAGE, {})
    .metadataMatchesExpectedShape, false);
});

test('rejects stopped, unexpected-image or unknown containers', () => {
  assert.equal(check(false).metadataMatchesExpectedShape, false);
  assert.equal(check(true, 'postgres:17', PORTS).metadataMatchesExpectedShape, false);
  assert.equal(assess('prod_database', true, IMAGE, PORTS).metadataMatchesExpectedShape, false);
});

test('Docker command only inspects three approved nonsecret scalar fields', () => {
  const seen = [];
  const values = [true, IMAGE, PORTS];
  const fakeRunner = (bin, args) => {
    seen.push([bin, ...args]);
    assert.equal(bin, 'docker');
    assert.deepEqual(args.slice(0, 3), ['inspect', '--type=container', '--format']);
    assert.equal(args[4], CONTAINER);
    assert.ok(Object.values(INSPECTION_FORMATS).includes(args[3]));
    assert.doesNotMatch(args[3], /Env|Mounts|Config\}\}/);
    return JSON.stringify(values[seen.length - 1]);
  };
  const result = inspectDocker(CONTAINER, fakeRunner);
  assert.equal(seen.length, 3);
  assert.equal(result.metadataMatchesExpectedShape, true);
});

test('invalid container argument fails without invoking docker', () => {
  let invoked = false;
  assert.throws(() => inspectDocker('bad;name', () => { invoked = true; }));
  assert.equal(invoked, false);
});

test('CLI without explicit container never inspects Docker, always NO-GO exit 2', () => {
  const r = spawnSync(process.execPath, [path.join(__dirname, 'v18-local-docker-preflight.cjs')],
    { encoding: 'utf8', timeout: 5000, env: {} });
  assert.equal(r.status, 2);
  assert.equal(r.stdout, '');
  assert.match(r.stderr, /details redacted/);
});
