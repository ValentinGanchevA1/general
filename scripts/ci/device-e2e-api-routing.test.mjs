import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { runInNewContext } from 'node:vm';
import test from 'node:test';
import { transform } from 'esbuild';

// Execute the actual TypeScript config under a release-like environment
// without React Native, Gradle, devices or network access.
const configSource = await readFile(join(process.cwd(), 'apps/mobile/src/config.ts'), 'utf8');
const compiled = await transform(configSource, {
  loader: 'ts',
  format: 'cjs',
  target: 'es2022',
});

function releaseConfig(env = {}) {
  const module = { exports: {} };
  const requireLocal = (name) => {
    if (name !== 'react-native') throw new Error('Unexpected module in configuration test');
    return { Platform: { OS: 'android' } };
  };
  runInNewContext(compiled.code, {
    module,
    exports: module.exports,
    require: requireLocal,
    process: { env },
    __DEV__: false,
  });
  return module.exports.Config;
}

test('normal signed release keeps the production API, ignoring E2E override', () => {
  const config = releaseConfig({ NEXA_E2E_API_BASE_URL: 'https://nexa-stage.example.invalid' });
  assert.equal(config.API_BASE_URL, 'https://g88-api.onrender.com');
  assert.equal(config.E2E_DEVICE_PROBE, false);
});

test('probe-enabled release APK must use the approved staging API origin', () => {
  const config = releaseConfig({
    NEXA_E2E_DEVICE_PROBE: '1',
    NEXA_E2E_API_BASE_URL: 'https://nexa-stage.example.invalid/',
  });
  assert.equal(config.API_BASE_URL, 'https://nexa-stage.example.invalid');
  assert.equal(config.E2E_DEVICE_PROBE, true);
});

test('probe APK fails closed when staging URL is missing or points to production', () => {
  for (const url of ['', 'https://g88-api.onrender.com', 'https://G88-API.onrender.com.']) {
    assert.throws(
      () => releaseConfig({ NEXA_E2E_DEVICE_PROBE: '1', NEXA_E2E_API_BASE_URL: url }),
      /Probe-enabled release APK requires a separate HTTPS staging API/,
      url,
    );
  }
});

test('probe APK rejects HTTP, embedded credentials, paths and query parameters', () => {
  const invalid = [
    'http://nexa-stage.example.invalid',
    'https://user:pass@nexa-stage.example.invalid',
    'https://nexa-stage.example.invalid/api/v1',
    'https://nexa-stage.example.invalid/?token=abc',
  ];
  for (const url of invalid) {
    assert.throws(
      () => releaseConfig({ NEXA_E2E_DEVICE_PROBE: '1', NEXA_E2E_API_BASE_URL: url }),
      /Probe-enabled release APK requires a separate HTTPS staging API/,
      url,
    );
  }
});
