import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

const build = readFileSync('web/build.mjs', 'utf8');
const app = readFileSync('web/src/app.ts', 'utf8');
const edge = readFileSync('web/edge.mjs', 'utf8');

test('public demo compile flag comes only from the existing public demo setting', () => {
  assert.match(build, /__NEXUS_PUBLIC_DEMO_ONLY__:\s*JSON\.stringify\(process\.env\.PUBLIC_DEMO_ONLY === '1'\)/u);
  assert.match(edge, /const publicDemoOnly = process\.env\.PUBLIC_DEMO_ONLY === '1'/u);
});

test('demo never attempts session restoration on initial load', () => {
  assert.match(app, /if \(!__NEXUS_PUBLIC_DEMO_ONLY__\) void restoreSession\(\);/u);
});

test('demo does not render sign-in controls or an authentication dialog', () => {
  assert.match(app, /__NEXUS_PUBLIC_DEMO_ONLY__ \? '<span class="mode">Public demo<\/span>'/u);
  assert.match(app, /__NEXUS_PUBLIC_DEMO_ONLY__ \? '' : '<button class="primary" id="auth-top">/u);
  assert.match(app, /function authPanel\(\): string \{\s*if \(__NEXUS_PUBLIC_DEMO_ONLY__\) return '';/u);
});

test('edge continues refusing all backend routes in public demo', () => {
  assert.match(edge, /if \(isProxyPath\(target\.pathname\) && publicDemoOnly\)/u);
  assert.match(edge, /if \(publicDemoOnly \|\| !target/u);
});
