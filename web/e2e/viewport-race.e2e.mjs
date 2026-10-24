import { readFile } from 'node:fs/promises';
import { createServer } from 'node:http';
import { createRequire } from 'node:module';
import { join } from 'node:path';
import { build } from 'esbuild';
import {
  assert,
  cleanupChrome,
  createTab,
  delay,
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
  nodePaths: ['apps/admin/node_modules'],
});
const appJs = appBuild.outputFiles[0]?.text;
if (!appJs) throw new Error('web app bundle was not produced');

const html = `<!doctype html>
<html lang="en" data-theme="dark">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width,initial-scale=1">
  <title>NEXA viewport race E2E</title>
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

const backendRequire = createRequire(new URL('../../apps/backend/package.json', import.meta.url));
const { Server: SocketIOServer } = backendRequire('socket.io');

const discoveryBodies = [];
const canceledDiscovery = [];
let discoveryCount = 0;

const server = createServer((request, response) => {
  void handleRequest(request, response).catch((error) => {
    if (response.headersSent || response.destroyed) return;
    sendJson(response, 500, { error: error instanceof Error ? error.message : 'unknown' });
  });
});
const socketServer = new SocketIOServer(server, {
  transports: ['websocket', 'polling'],
  cors: { origin: true, credentials: true },
});
socketServer.of('/realtime').on('connection', () => undefined);

await new Promise((resolve, reject) => {
  server.once('error', reject);
  server.listen(0, '127.0.0.1', resolve);
});

const address = server.address();
if (!address || typeof address === 'string') throw new Error('failed to resolve viewport fixture server port');
const baseUrl = `http://127.0.0.1:${address.port}`;
const runtime = await launchChrome('nexa-viewport-e2e-');

try {
  const tab = await createTab(runtime.cdp, `${baseUrl}/`, "document.querySelector('.slippy-surface') !== null");

  await waitFor(
    async () => await evaluate(runtime.cdp, tab, "document.querySelector('[aria-label=\"Initial Result\"]') !== null"),
    5_000,
    'initial authenticated discovery result',
  );
  assert(discoveryBodies.length === 1, `expected one initial discovery request, got ${discoveryBodies.length}`);

  await panRight(tab);
  await waitFor(() => discoveryBodies.length >= 2, 3_000, 'slow viewport discovery request');

  await panRight(tab);
  await waitFor(() => discoveryBodies.length >= 3, 3_000, 'superseding viewport discovery request');

  const slow = discoveryBodies[1];
  const fresh = discoveryBodies[2];
  assert(slow && fresh, 'missing viewport request bodies');
  assert(
    fresh.viewport.sw.lng > slow.viewport.sw.lng && fresh.viewport.ne.lng > slow.viewport.ne.lng,
    `viewport did not advance east between requests: ${JSON.stringify({ slow: slow.viewport, fresh: fresh.viewport })}`,
  );

  await waitFor(
    async () => await evaluate(runtime.cdp, tab, "document.querySelector('[aria-label=\"Fresh Result\"]') !== null"),
    4_000,
    'fresh discovery result',
  );

  await delay(900);
  assert(
    await evaluate(runtime.cdp, tab, "document.querySelector('[aria-label=\"Fresh Result\"]') !== null"),
    'fresh result was lost after the slow request completed',
  );
  assert(
    await evaluate(runtime.cdp, tab, "document.querySelector('[aria-label=\"Stale Result\"]') === null"),
    'stale discovery response overwrote the latest viewport result',
  );
  assert(canceledDiscovery.includes(2), `slow request was not aborted by the superseding viewport: ${JSON.stringify(canceledDiscovery)}`);

  console.log('NEXA viewport E2E passed: settled viewport bodies advance, slow discovery aborts, stale response cannot overwrite fresh results.');
} catch (error) {
  const chromeErrors = runtime.errors();
  if (chromeErrors) console.error(chromeErrors);
  throw error;
} finally {
  await cleanupChrome(runtime);
  await new Promise((resolve) => socketServer.close(resolve));
}

async function handleRequest(request, response) {
  const parsed = new URL(request.url ?? '/', 'https://nexa.invalid');

  if (request.method === 'GET' && parsed.pathname === '/') {
    response.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8', 'Cache-Control': 'no-store' });
    response.end(html);
    return;
  }
  if (request.method === 'GET' && parsed.pathname === '/app.js') {
    response.writeHead(200, { 'Content-Type': 'text/javascript; charset=utf-8', 'Cache-Control': 'no-store' });
    response.end(appJs);
    return;
  }
  if (request.method === 'GET' && parsed.pathname === '/styles.css') {
    sendCss(response, styles);
    return;
  }
  if (request.method === 'GET' && parsed.pathname === '/map.css') {
    sendCss(response, mapStyles);
    return;
  }
  if (request.method === 'GET' && parsed.pathname === '/connections.css') {
    sendCss(response, connectionStyles);
    return;
  }

  if (request.method === 'POST' && parsed.pathname === '/api/v1/auth/web/refresh') {
    response.setHeader('Set-Cookie', 'nexa_web_refresh=e2e-refresh; HttpOnly; SameSite=Lax; Path=/api/v1/auth/web');
    sendJson(response, 200, {
      accessToken: 'viewport-e2e-token',
      expiresAt: new Date(Date.now() + 15 * 60_000).toISOString(),
    });
    return;
  }

  if (request.method === 'GET' && parsed.pathname === '/api/v1/auth/me') {
    sendJson(response, 200, {
      id: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
      displayName: 'Viewport Tester',
      email: 'viewport@example.test',
      verification: 'phone',
    });
    return;
  }

  if (request.method === 'GET' && parsed.pathname === '/api/v1/feed') {
    sendJson(response, 200, { items: [] });
    return;
  }

  if (request.method === 'GET' && parsed.pathname === '/api/v1/interactions/inbox') {
    sendJson(response, 200, { items: [] });
    return;
  }

  if (request.method === 'GET' && parsed.pathname === '/api/v1/conversations') {
    sendJson(response, 200, []);
    return;
  }

  if (request.method === 'POST' && parsed.pathname === '/api/v1/discovery/nearby') {
    discoveryCount += 1;
    const requestNumber = discoveryCount;
    const body = JSON.parse(await readBody(request));
    discoveryBodies.push(body);

    let completed = false;
    response.on('close', () => {
      if (!completed && !response.writableEnded && !canceledDiscovery.includes(requestNumber)) {
        canceledDiscovery.push(requestNumber);
      }
    });

    const name = requestNumber === 1 ? 'Initial Result' : requestNumber === 2 ? 'Stale Result' : 'Fresh Result';
    const waitMs = requestNumber === 2 ? 750 : requestNumber >= 3 ? 40 : 0;
    if (waitMs > 0) await delay(waitMs);
    if (response.destroyed || response.writableEnded) return;

    completed = true;
    sendJson(response, 200, discoveryResponse(name, body, requestNumber));
    return;
  }

  response.writeHead(404).end('Not Found');
}

function discoveryResponse(displayName, body, requestNumber) {
  const viewport = body.viewport;
  const lat = (viewport.ne.lat + viewport.sw.lat) / 2;
  const lng = (viewport.ne.lng + viewport.sw.lng) / 2;
  return {
    points: [{
      kind: 'user',
      id: `e2e-user-${requestNumber}`,
      lat,
      lng,
      meta: {
        displayName,
        avatarUrl: null,
        verification: 'phone',
        online: true,
        lastSeenAt: new Date().toISOString(),
        verifiedBadge: true,
      },
    }],
    resolution: 10,
    generatedAt: new Date().toISOString(),
    viewportHash: `e2e-${requestNumber}`,
  };
}

async function panRight(tab) {
  await evaluate(runtime.cdp, tab, `(() => {
    const surface = document.querySelector('.slippy-surface');
    if (!surface) throw new Error('map surface missing');
    surface.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowRight', bubbles: true, cancelable: true }));
  })()`);
}

async function readBody(request) {
  let body = '';
  for await (const chunk of request) body += String(chunk);
  return body;
}

function sendCss(response, css) {
  response.writeHead(200, { 'Content-Type': 'text/css; charset=utf-8', 'Cache-Control': 'no-store' });
  response.end(css);
}

function sendJson(response, status, payload) {
  response.writeHead(status, { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store' });
  response.end(JSON.stringify(payload));
}
