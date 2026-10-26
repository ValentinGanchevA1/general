import assert from 'node:assert/strict';
import test from 'node:test';

import {
  readMapLibreReleaseConfig,
  validateMapLibreReleaseConfig,
} from './maplibre-release-config.mjs';

test('uses safe MapTiler defaults when optional release values are omitted', () => {
  assert.deepEqual(
    readMapLibreReleaseConfig({NEXA_MAPTILER_API_KEY: 'public-key'}),
    {
      apiKey: 'public-key',
      mapId: 'streets-v4',
      region: 'eu',
    },
  );
});

test('rejects a missing MapTiler API key', () => {
  assert.deepEqual(
    validateMapLibreReleaseConfig({apiKey: '', mapId: 'streets-v4', region: 'eu'}),
    {
      ok: false,
      reason: 'NEXA_MAPTILER_API_KEY is required for release builds',
    },
  );
});

test('rejects API keys containing whitespace or control characters', () => {
  const result = validateMapLibreReleaseConfig({
    apiKey: 'public key',
    mapId: 'streets-v4',
    region: 'eu',
  });

  assert.equal(result.ok, false);
});

test('rejects malformed map identifiers', () => {
  const result = validateMapLibreReleaseConfig({
    apiKey: 'public-key',
    mapId: '../unsafe-style',
    region: 'eu',
  });

  assert.equal(result.ok, false);
});

test('rejects unsupported MapTiler regions', () => {
  const result = validateMapLibreReleaseConfig({
    apiKey: 'public-key',
    mapId: 'streets-v4',
    region: 'custom-origin',
  });

  assert.equal(result.ok, false);
});

test('accepts the allowlisted EU release configuration', () => {
  assert.deepEqual(
    validateMapLibreReleaseConfig({
      apiKey: 'public-key',
      mapId: 'streets-v4',
      region: 'eu',
    }),
    {ok: true, mapId: 'streets-v4', region: 'eu'},
  );
});

test('accepts the allowlisted global release configuration', () => {
  assert.deepEqual(
    validateMapLibreReleaseConfig({
      apiKey: 'public-key',
      mapId: 'streets-v4',
      region: 'global',
    }),
    {ok: true, mapId: 'streets-v4', region: 'global'},
  );
});
