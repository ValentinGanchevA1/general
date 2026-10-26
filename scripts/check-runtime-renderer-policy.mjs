const [url, expectedRaw] = process.argv.slice(2);

if (!url || (expectedRaw !== 'true' && expectedRaw !== 'false')) {
  console.error(
    'Usage: node scripts/check-runtime-renderer-policy.mjs <url> <true|false>',
  );
  process.exit(2);
}

const expectedEnabled = expectedRaw === 'true';
const controller = new AbortController();
const timeout = setTimeout(() => controller.abort(), 10_000);

function fail(message) {
  console.error(`Runtime renderer policy check failed: ${message}`);
  process.exitCode = 1;
}

try {
  const response = await fetch(url, {
    method: 'GET',
    headers: { Accept: 'application/json' },
    redirect: 'error',
    signal: controller.signal,
  });

  if (response.status !== 200) {
    fail(`expected HTTP 200, received ${response.status}`);
  } else {
    const cacheControl = response.headers.get('cache-control') ?? '';
    if (!cacheControl.toLowerCase().includes('no-store')) {
      fail(`expected Cache-Control to include no-store, received ${JSON.stringify(cacheControl)}`);
    }

    const body = await response.json();
    const validShape =
      typeof body === 'object' &&
      body !== null &&
      body.version === 1 &&
      typeof body.mapLibreEnabled === 'boolean' &&
      Number.isInteger(body.cacheTtlSeconds) &&
      body.cacheTtlSeconds >= 1 &&
      body.cacheTtlSeconds <= 60;

    if (!validShape) {
      fail('response does not match the v1 runtime renderer policy contract');
    } else if (body.mapLibreEnabled !== expectedEnabled) {
      fail(
        `expected mapLibreEnabled=${expectedEnabled}, received ${body.mapLibreEnabled}`,
      );
    } else {
      console.log(
        `Runtime renderer policy verified: version=${body.version} mapLibreEnabled=${body.mapLibreEnabled} cacheTtlSeconds=${body.cacheTtlSeconds}`,
      );
    }
  }
} catch (error) {
  const message = error instanceof Error ? error.message : 'unknown error';
  fail(message);
} finally {
  clearTimeout(timeout);
}
