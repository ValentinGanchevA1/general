'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const { assertTarget, childEnvironment } = require('./start-backend.cjs');
const sample = {
  NODE_ENV:'development', IS_PULL_REQUEST:'false', PORT:'33188',
  DATABASE_URL:'postgresql://nexus_v8:example@127.0.0.1:55488/nexus_v8',
  REDIS_URL:'redis://:example@127.0.0.1:56388/0',
  REDIS_HOST:'127.0.0.1', REDIS_PORT:'56388',
  SOCKET_IO_REDIS_ADAPTER:'enabled',
  SOCKET_IO_REDIS_CHANNEL_PREFIX:'nexus:v8:local:socket.io',
  JWT_SECRET:'a'.repeat(96), JWT_REFRESH_SECRET:'b'.repeat(96),
  POSTHOG_ENABLED:'false', POSTHOG_PRIVACY_ENABLED:'false',
  ANALYTICS_HMAC_KEY:'', SENTRY_DSN:'',
};
test('accepts only pinned local targets',()=> assert.equal(assertTarget(sample),true));
test('blocks deviations and external telemetry',()=>{
  for(const patch of [
    {DATABASE_URL:'postgresql://nexus_v8:example@db.example.invalid:55488/nexus_v8'},
    {DATABASE_URL:'postgresql://nexus_v8:example@localhost:55488/nexus_v8'},
    {DATABASE_URL:'postgresql://nexus_v8:example@127.0.0.1:5432/nexus_v8'},
    {REDIS_URL:'redis://:example@localhost:56388/0'},
    {REDIS_URL:'redis://:example@127.0.0.1:6379/0'},
    {NODE_ENV:'production'}, {PORT:'3001'}, {POSTHOG_ENABLED:'true'},
    {SENTRY_DSN:'https://example.invalid'}, {JWT_REFRESH_SECRET:'a'.repeat(96)},
  ]) assert.throws(()=>assertTarget({...sample,...patch}));
});
test('does not inherit secrets from the calling shell',()=>{
  const env=childEnvironment(sample);
  assert.equal(env.NEXUS_V8_LOCAL_ONLY,'1');
  assert.equal(env.HOST,'127.0.0.1');
  assert.equal(env.DATABASE_URL,sample.DATABASE_URL);
  assert.equal(Object.hasOwn(env,'STRIPE_SECRET_KEY'),false);
  assert.equal(Object.hasOwn(env,'AWS_ACCESS_KEY_ID'),false);
  assert.equal(Object.hasOwn(env,'NODE_OPTIONS'),false);
});
test('main.ts skips root dotenv and binds loopback for sandbox',()=>{
  const {readFileSync}=require('node:fs');
  const {resolve}=require('node:path');
  const main=readFileSync(resolve(__dirname,'../../apps/backend/src/main.ts'),'utf8');
  assert.match(main,/if \(process\.env\.NEXUS_V8_LOCAL_ONLY !== '1'\)/);
  assert.match(main,/app\.listen\(port, bindHost\)/);
  assert.match(main,/127\.0\.0\.1/);
});
