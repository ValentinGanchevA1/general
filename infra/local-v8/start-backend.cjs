'use strict';
/**
 * Fail-closed Windows/Node launcher for the local NEXUS v8 backend.
 * Reads ONLY infra/local-v8/.env.backend.local, not process.env secrets.
 * It never starts migrations or seeds. Use --check first.
 */
const { readFileSync, existsSync } = require('node:fs');
const { spawn } = require('node:child_process');
const { resolve, join } = require('node:path');

const root = resolve(__dirname, '..', '..');
const envPath = join(__dirname, '.env.backend.local');
const apiPath = join(root, 'apps', 'backend', 'dist', 'main.js');

const KEYS = new Set([
  'NODE_ENV','IS_PULL_REQUEST','PORT','DATABASE_URL','REDIS_URL',
  'REDIS_HOST','REDIS_PORT','SOCKET_IO_REDIS_ADAPTER',
  'SOCKET_IO_REDIS_CHANNEL_PREFIX','JWT_SECRET','JWT_REFRESH_SECRET',
  'ANALYTICS_HMAC_KEY','POSTHOG_ENABLED','POSTHOG_PRIVACY_ENABLED','SENTRY_DSN',
]);
function loadSettings(path) {
  const out = Object.create(null);
  for (const line of readFileSync(path, 'utf8').split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;
    const i = line.indexOf('=');
    if (i === -1) throw Error('Malformed local backend setting');
    const key = line.slice(0, i).trim();
    if (!KEYS.has(key) || Object.hasOwn(out,key)) throw Error('Unexpected or duplicate backend setting');
    out[key] = line.slice(i + 1).trim();
  }
  return out;
}
function assertTarget(env) {
  if (env.NODE_ENV !== 'development' || env.IS_PULL_REQUEST !== 'false' || env.PORT !== '33188') {
    throw Error('Local backend startup configuration mismatch');
  }
  const pg = new URL(env.DATABASE_URL || 'invalid:');
  const redis = new URL(env.REDIS_URL || 'invalid:');
  if (pg.protocol !== 'postgresql:' || pg.hostname !== '127.0.0.1' || pg.port !== '55488' ||
      pg.pathname !== '/nexus_v8' || decodeURIComponent(pg.username) !== 'nexus_v8' || !pg.password ||
      pg.search || pg.hash) {
    throw Error('Refusing nonlocal database target');
  }
  if (redis.protocol !== 'redis:' || redis.hostname !== '127.0.0.1' || redis.port !== '56388' ||
      redis.pathname !== '/0' || !redis.password || redis.search || redis.hash) {
    throw Error('Refusing nonlocal Redis target');
  }
  if (env.REDIS_HOST !== '127.0.0.1' || env.REDIS_PORT !== '56388' ||
      env.SOCKET_IO_REDIS_ADAPTER !== 'enabled' ||
      env.SOCKET_IO_REDIS_CHANNEL_PREFIX !== 'nexus:v8:local:socket.io') {
    throw Error('Refusing unisolated realtime configuration');
  }
  if ((env.JWT_SECRET?.length || 0) < 64 || (env.JWT_REFRESH_SECRET?.length || 0) < 64 ||
      env.JWT_SECRET === env.JWT_REFRESH_SECRET) throw Error('Sandbox JWT secrets must be independent');
  for (const key of ['POSTHOG_ENABLED','POSTHOG_PRIVACY_ENABLED']) {
    if (env[key] !== 'false') throw Error('External analytics forbidden in local sandbox');
  }
  if (env.SENTRY_DSN !== '' || env.ANALYTICS_HMAC_KEY !== '') {
    throw Error('External telemetry forbidden in local sandbox');
  }
  return true;
}
function childEnvironment(settings) {
  // Do not inherit ambient DATABASE_URL, API keys, proxy settings or production secrets.
  const allowedOS = process.platform === 'win32'
    ? ['SystemRoot','WINDIR','COMSPEC','PATH','PATHEXT','TEMP','TMP','USERPROFILE','APPDATA','LOCALAPPDATA']
    : ['PATH','HOME','TMPDIR'];
  const child = Object.create(null);
  for (const key of allowedOS) if (process.env[key]) child[key] = process.env[key];
  for (const [key,value] of Object.entries(settings)) child[key] = value;
  child.NEXUS_V8_LOCAL_ONLY = '1';
  child.HOST = '127.0.0.1';
  child.CORS_ORIGINS = 'http://127.0.0.1:33188,http://localhost:33188';
  return child;
}
function run(args = process.argv.slice(2)) {
  if (!existsSync(envPath)) throw Error('Local-only env not found: run bootstrap.ps1');
  const settings = loadSettings(envPath);
  assertTarget(settings);
  if (args.includes('--check')) {
    process.stdout.write('PASS: v8 backend environment is pinned to local database, Redis, loopback API and disabled telemetry. No process started.\n');
    return;
  }
  if (args.length > 0) throw Error('Unknown launcher arguments');
  if (!existsSync(apiPath)) throw Error('Compiled NestJS entry not found. Build backend locally before start.');
  process.stdout.write('Launching NEXUS v8 local API on 127.0.0.1:33188; no migrations. Press Ctrl+C to stop.\n');
  const child = spawn(process.execPath, [apiPath], {
    cwd: join(root, 'apps', 'backend'),
    env: childEnvironment(settings),
    stdio: 'inherit',
    windowsHide: true,
  });
  child.on('error', () => { process.stderr.write('Local backend failed to start.\n'); process.exitCode = 1; });
  child.on('exit', (code) => { process.exitCode = code === 0 ? 0 : 1; });
  for (const signal of ['SIGINT','SIGTERM']) process.once(signal, () => child.kill(signal));
}
if (require.main === module) {
  try { run(); }
  catch { process.stderr.write('Local backend launch refused. Check sandbox configuration and compiled output (secrets redacted).\n'); process.exitCode = 2; }
}
module.exports = { loadSettings, assertTarget, childEnvironment };
