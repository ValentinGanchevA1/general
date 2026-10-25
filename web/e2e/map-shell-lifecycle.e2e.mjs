import { readFile } from 'node:fs/promises';
import { createServer } from 'node:http';
import { build } from 'esbuild';
import {
  assert,
  cleanupChrome,
  closeServer,
  createTab,
  evaluate,
  launchChrome,
  waitFor,
} from './chrome-cdp.mjs';

const [styles, mapStyles, connectionStyles] = await Promise.all([
  readFile('web/styles.css', 'utf8'),
  readFile('web/map.css', 'utf8'),
  readFile('web/connections.css', 'utf8'),
]);

const appBuild = await build({
  entryPoints: ['web/src/app.ts'],
  bundle: true,
  platform: 'browser',
  format: 'esm',
  target: ['chrome120'],
  write: false,
  logLevel: 'silent',
});
const appJs = appBuild.outputFiles[0]?.text;
if (!appJs) throw new Error('web app bundle was not produced');

const html = `<!doctype html>
<html lang="en" data-theme="dark">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width,initial-scale=1">
  <title>NEXA map shell lifecycle E2E</title>
  <link rel="stylesheet" href="/styles.css">
  <link rel="stylesheet" href="/map.css">
  <link rel="stylesheet" href="/connections.css">
  <style>#nexa-map,.slippy-surface{min-height:420px}</style>
</head>
<body>
  <div id="app"></div>
  <script type="module" src="/app.js"></script>
</body>
</html>`;

const server = createServer((request, response) => {
  const url = new URL(request.url ?? '/', 'http://127.0.0.1');
  setCsp(response);

  if (request.method === 'GET' && url.pathname === '/') return send(response, 200, 'text/html; charset=utf-8', html);
  if (request.method === 'GET' && url.pathname === '/app.js') return send(response, 200, 'text/javascript; charset=utf-8', appJs);
  if (request.method === 'GET' && url.pathname === '/styles.css') return send(response, 200, 'text/css; charset=utf-8', styles);
  if (request.method === 'GET' && url.pathname === '/map.css') return send(response, 200, 'text/css; charset=utf-8', mapStyles);
  if (request.method === 'GET' && url.pathname === '/connections.css') return send(response, 200, 'text/css; charset=utf-8', connectionStyles);

  if (request.method === 'POST' && url.pathname === '/api/v1/auth/web/refresh') {
    return send(response, 401, 'application/json; charset=utf-8', '{"message":"no fixture session"}');
  }

  response.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' });
  response.end('Not Found');
});

await new Promise((resolve, reject) => {
  server.once('error', reject);
  server.listen(0, '127.0.0.1', resolve);
});
const address = server.address();
if (!address || typeof address === 'string') throw new Error('failed to resolve map shell fixture port');
const baseUrl = `http://127.0.0.1:${address.port}`;
const runtime = await launchChrome('nexa-map-shell-e2e-');

try {
  const tab = await createTab(runtime.cdp, `${baseUrl}/`, "document.querySelector('.slippy-surface') !== null");

  await evaluate(runtime.cdp, tab, `(() => {
    globalThis.__NEXA_MAP_NODE__ = document.querySelector('#nexa-map');
    globalThis.__NEXA_MAP_SURFACE__ = document.querySelector('.slippy-surface');
    return true;
  })()`);

  const initialUpdateCount = await evaluate(
    runtime.cdp,
    tab,
    "Number(document.querySelector('.slippy-surface')?.dataset.mapUpdateCount ?? '-1')",
  );
  assert(initialUpdateCount === 0, `unexpected initial map update count ${initialUpdateCount}`);

  await evaluate(runtime.cdp, tab, "document.querySelector('[data-kind=\"event\"]')?.click()");
  await waitFor(
    async () => await evaluate(runtime.cdp, tab, "document.querySelector('#nexa-map') === globalThis.__NEXA_MAP_NODE__"),
    2_000,
    'preserved map node after filter render',
  );
  assert(
    await evaluate(runtime.cdp, tab, "document.querySelector('.slippy-surface') === globalThis.__NEXA_MAP_SURFACE__"),
    'map surface was replaced during filter render',
  );
  assert(
    await evaluate(runtime.cdp, tab, "Number(document.querySelector('.slippy-surface')?.dataset.mapUpdateCount ?? '0') >= 1"),
    'same-container map controller did not receive the filtered point update',
  );

  await evaluate(runtime.cdp, tab, "document.querySelector('#theme')?.click()");
  assert(
    await evaluate(runtime.cdp, tab, "document.querySelector('#nexa-map') === globalThis.__NEXA_MAP_NODE__"),
    'theme render replaced the map container',
  );

  await evaluate(runtime.cdp, tab, "document.querySelector('[data-tab=\"discover\"]')?.click()");
  await waitFor(
    async () => await evaluate(runtime.cdp, tab, "document.querySelector('#nexa-map') === null"),
    2_000,
    'map removal after leaving Map tab',
  );
  assert(
    await evaluate(runtime.cdp, tab, "globalThis.__NEXA_MAP_NODE__?.isConnected === false"),
    'old map container remained connected after leaving Map tab',
  );

  await evaluate(runtime.cdp, tab, "document.querySelector('[data-target=\"map\"]')?.click()");
  await waitFor(
    async () => await evaluate(runtime.cdp, tab, "document.querySelector('.slippy-surface') !== null"),
    2_000,
    'fresh map after returning from Discover',
  );
  assert(
    await evaluate(runtime.cdp, tab, "document.querySelector('#nexa-map') !== globalThis.__NEXA_MAP_NODE__"),
    'returning to Map reused a detached container instead of creating one fresh map lifecycle',
  );

  console.log('NEXA map shell lifecycle E2E passed: same node/controller across Map renders, fresh lifecycle after tab exit.');
} catch (error) {
  const chromeErrors = runtime.errors();
  if (chromeErrors) console.error(chromeErrors);
  throw error;
} finally {
  await cleanupChrome(runtime);
  await closeServer(server);
}

function send(response, status, contentType, body) {
  response.writeHead(status, {
    'Content-Type': contentType,
    'Cache-Control': 'no-store',
  });
  response.end(body);
}

function setCsp(response) {
  response.setHeader(
    'Content-Security-Policy',
    "default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' data:; connect-src 'self'; worker-src 'self'; object-src 'none'; base-uri 'none'; frame-ancestors 'none'",
  );
}
