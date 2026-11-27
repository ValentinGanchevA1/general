'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const { readFileSync } = require('node:fs');
const { join } = require('node:path');
const dir = __dirname;
const read = (name) => readFileSync(join(dir, name), 'utf8');

test('Compose is a distinct internal, loopback-only project with no inherited production services', () => {
  const compose = read('compose.yaml');
  assert.match(compose, /^name: nexus-v8-local$/m);
  assert.match(compose, /internal: false/);
  assert.match(compose, /127\.0\.0\.1:\$\{NEXUS_V8_POSTGRES_PORT:-55488\}:5432/);
  assert.match(compose, /127\.0\.0\.1:\$\{NEXUS_V8_REDIS_PORT:-56388\}:6379/);
  assert.match(compose, /POSTGRES_DB: nexus_v8/);
  assert.match(compose, /POSTGRES_USER: nexus_v8/);
  assert.match(compose, /image: postgis\/postgis:16-3\.4/);
  assert.match(compose, /redis:7-alpine/);
  assert.match(compose, /--requirepass/);
  assert.match(compose, /no-new-privileges:true/g);
  assert.doesNotMatch(compose, /\b(g88-api|supabase_db|g88-postgres|g88-redis|54322|DATABASE_URL:)\b/);
  assert.doesNotMatch(compose, /0\.0\.0\.0:|\$\{POSTGRES_PORT|\$\{REDIS_PORT/);
  assert.doesNotMatch(compose, /migration:run|\bseed\b|autoDeploy/);
});

test('Bootstrap generates independent secret references and refuses replacement', () => {
  const code = read('bootstrap.ps1');
  assert.match(code, /RandomNumberGenerator/);
  assert.match(code, /Test-Path -LiteralPath \$composeEnv/);
  assert.match(code, /Test-Path -LiteralPath \$backendEnv/);
  assert.match(code, /WriteAllText/);
  assert.match(code, /UTF8Encoding\(\$false\)/);
  assert.match(code, /NEXUS_V8_POSTGRES_PASSWORD=/);
  assert.match(code, /NEXUS_V8_REDIS_PASSWORD=/);
  assert.match(code, /DATABASE_URL=postgresql:\/\/nexus_v8:/);
  assert.match(code, /SOCKET_IO_REDIS_CHANNEL_PREFIX=nexus:v8:local/);
  assert.match(code, /POSTHOG_ENABLED=false/);
  assert.match(code, /IS_PULL_REQUEST=false/);
});

test('Smoke is pinned to sandbox services and never invokes migration', () => {
  const code = read('smoke.ps1');
  assert.match(code, /pg_available_extensions/);
  assert.doesNotMatch(code, /postgresql-16-h3/);
  assert.match(code, /redis-cli ping/);
  assert.match(code, /nexus_v8\/nexus_v8/);
  assert.match(code, /127\.0\.0\.1:55488/);
  assert.match(code, /127\.0\.0\.1:56388/);
  assert.doesNotMatch(code, /\bmigrate\.js\b|\bseed\.js\b|down --volumes/);
});

test('Migration wrapper must be explicitly applied to a pinned local target', () => {
  const code = read('migrate-local.ps1');
  assert.match(code, /\[switch\]\$Apply/);
  assert.match(code, /\$uri\.Host -ne '127\.0\.0\.1'/);
  assert.match(code, /\$uri\.Port -ne 55488/);
  assert.match(code, /\$uri\.AbsolutePath -ne '\/nexus_v8'/);
  assert.match(code, /if \(!\$Apply\)/);
  assert.match(code, /DATABASE_URL/);
});

test('No credential file is checked into the branch as an artifact', () => {
  const ignore = readFileSync(join(dir, '..', '..', '.gitignore'), 'utf8');
  assert.match(ignore, /^\.env\*/m);
  assert.doesNotMatch(read('compose.yaml'), /POSTGRES_PASSWORD: [a-f0-9]{20,}/);
});
