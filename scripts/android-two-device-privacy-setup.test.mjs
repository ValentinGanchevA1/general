import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
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


test('partial setup cleanup retains evidence after 401 and resumes without deleting already-cleaned users', async () => {
  const directory = await mkdtemp(join(tmpdir(), 'nexus-e2e-cleanup-'));
  const stateFile = join(directory, 'state.json');
  const preload = join(directory, 'fetch-mock.mjs');
  const baseUrl = 'https://nexa-stage.example.invalid';
  try {
    await writeFile(stateFile, JSON.stringify({
      baseUrl,
      password: 'synthetic-test-only',
      a: { accessToken: 'already-cleanable' },
      b: { accessToken: 'temporarily-unauthorized' },
      cleaned: [],
    }), { mode: 0o600 });

    // Fail one synthetic DELETE with HTTP 401; no remote service is contacted.
    await writeFile(preload, `
      globalThis.fetch = async (_url, options) => ({
        status: options?.headers?.Authorization === 'Bearer temporarily-unauthorized' &&
          process.env.NEXUS_TEST_FAIL_CLEANUP === '1' ? 401 : 204,
        json: async () => ({}),
      });
    `);
    const cleanup = (fail) => spawnSync(process.execPath, [
      '--import', preload, entry, 'cleanup',
    ], {
      encoding: 'utf8',
      timeout: 10_000,
      env: {
        ...process.env,
        DEVICE_E2E_BASE_URL: baseUrl,
        DEVICE_E2E_STAGING_APPROVED: 'true',
        DEVICE_E2E_STATE_FILE: stateFile,
        NEXUS_TEST_FAIL_CLEANUP: fail ? '1' : '0',
      },
    });

    const first = cleanup(true);
    assert.equal(first.error, undefined);
    assert.notEqual(first.status, 0);
    assert.match(first.stderr, /cleanup failed: HTTP 401/);
    const partial = JSON.parse(await readFile(stateFile, 'utf8'));
    assert.deepEqual(partial.cleaned, ['a']);
    assert.ok(partial.b);

    const second = cleanup(false);
    assert.equal(second.error, undefined);
    assert.equal(second.status, 0, second.stderr);
    await assert.rejects(() => readFile(stateFile, 'utf8'), { code: 'ENOENT' });
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
});
