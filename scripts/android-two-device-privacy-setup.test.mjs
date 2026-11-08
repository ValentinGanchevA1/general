import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import test from 'node:test';

// The verify command must never reach the network; it checks the exact target
// that the real prepare/cleanup commands will use.
const entry = fileURLToPath(new URL('./android-two-device-privacy-setup.mjs', import.meta.url));

function verify(url, approved) {
  const result = spawnSync(process.execPath, [entry, 'verify'], {
    encoding: 'utf8',
    timeout: 10_000,
    env: {
      ...process.env,
      DEVICE_E2E_BASE_URL: url,
      DEVICE_E2E_STAGING_APPROVED: approved,
    },
  });
  assert.equal(result.error, undefined, result.error?.message);
  return { status: result.status, output: result.stderr + result.stdout };
}

test('E2E preflight rejects missing owner staging approval', () => {
  const result = verify('https://nexa-stage.example.invalid', '');
  assert.notEqual(result.status, 0);
  assert.match(result.output, /explicit approval/);
});

test('E2E preflight rejects missing staging URL even with approval', () => {
  const result = verify('', 'true');
  assert.notEqual(result.status, 0);
  assert.match(result.output, /explicit staging HTTPS URL/);
});

test('E2E preflight rejects the live backend and trailing-dot alias', () => {
  for (const live of ['https://g88-api.onrender.com', 'https://G88-API.onrender.com.']) {
    const result = verify(live, 'true');
    assert.notEqual(result.status, 0);
    assert.match(result.output, /never create test accounts on the live/);
  }
});

test('E2E preflight rejects HTTP, credentials, paths and querystrings', () => {
  const invalid = [
    'http://nexa-stage.example.invalid',
    'https://user:password@nexa-stage.example.invalid',
    'https://nexa-stage.example.invalid/api/v1',
    'https://nexa-stage.example.invalid/?token=secret',
  ];
  for (const url of invalid) {
    const result = verify(url, 'true');
    assert.notEqual(result.status, 0);
    assert.match(result.output, /credential-free HTTPS origin/);
  }
});

test('E2E preflight accepts an explicitly approved synthetic staging origin without making requests', () => {
  const result = verify('https://nexa-stage.example.invalid', 'true');
  assert.equal(result.status, 0, result.output);
});
