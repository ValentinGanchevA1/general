import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { createServer } from 'node:http';
import { test } from 'node:test';

const script = new URL('./check-runtime-renderer-policy.mjs', import.meta.url);
const valid = { version: 1, mapLibreEnabled: false, cacheTtlSeconds: 60 };

async function verify({ status = 200, body = valid, cacheControl = 'no-store', expected = 'false' }) {
  const server = createServer((_request, response) => {
    response.writeHead(status, { 'Content-Type': 'application/json', 'Cache-Control': cacheControl });
    response.end(JSON.stringify(body));
  });
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  try {
    const address = server.address();
    assert.ok(address && typeof address === 'object');
    return await new Promise((resolve, reject) => {
      const child = spawn(process.execPath, [script.pathname, `http://127.0.0.1:${address.port}`, expected]);
      let output = '';
      child.stdout.on('data', chunk => { output += chunk; });
      child.stderr.on('data', chunk => { output += chunk; });
      child.on('error', reject);
      child.on('close', code => resolve({ code, output }));
    });
  } finally {
    await new Promise(resolve => server.close(resolve));
  }
}

test('accepts the disabled and enabled HTTP 200 policy contracts', async () => {
  for (const enabled of [false, true]) {
    const result = await verify({ body: { ...valid, mapLibreEnabled: enabled }, expected: String(enabled) });
    assert.equal(result.code, 0, result.output);
  }
});

for (const status of [201, 202, 404, 500]) {
  test(`rejects HTTP ${status} even with a valid policy body`, async () => {
    const result = await verify({ status });
    assert.equal(result.code, 1);
    assert.match(result.output, new RegExp(`expected HTTP 200, received ${status}`));
  });
}

test('rejects missing no-store', async () => {
  const result = await verify({ cacheControl: 'public, max-age=60' });
  assert.equal(result.code, 1);
  assert.match(result.output, /expected Cache-Control to include no-store/);
});

test('rejects invalid or unbounded policy shapes', async () => {
  for (const body of [null, { ...valid, version: 2 }, { ...valid, mapLibreEnabled: 'false' },
    ...[0, 61, 1.5].map(cacheTtlSeconds => ({ ...valid, cacheTtlSeconds }))]) {
    const result = await verify({ body });
    assert.equal(result.code, 1);
    assert.match(result.output, /does not match the v1/);
  }
});

test('rejects an unexpected permission', async () => {
  const result = await verify({ body: { ...valid, mapLibreEnabled: true } });
  assert.equal(result.code, 1);
  assert.match(result.output, /expected mapLibreEnabled=false, received true/);
});
