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

const fixtureBuild = await build({
  stdin: {
    contents: `
      import { mountMapLibreMap } from './web/src/maplibre-map.ts';

      const container = document.querySelector('#map');
      if (!(container instanceof HTMLElement)) throw new Error('map container missing');

      globalThis.__NEXA_MAP_TEST__ = { settled: null };

      mountMapLibreMap({
        container,
        camera: { center: { lat: 43.2077, lng: 27.9167 }, zoom: 13 },
        runtime: {
          status: 'ready',
          renderer: 'maplibre',
          provider: 'maptiler',
          workerUrl: '/dist/maplibre-worker.mjs',
          styleUrl: '/style.json',
          attribution: '© MapTiler © OpenStreetMap contributors',
          apiOrigin: 'https://api.maptiler.eu',
        },
        points: [
          {
            kind: 'user',
            id: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
            lat: 43.211,
            lng: 27.92,
            meta: {
              displayName: 'Map Tester',
              avatarUrl: null,
              verification: 'phone',
              online: true,
              lastSeenAt: null,
            },
          },
          {
            kind: 'event',
            id: 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb',
            lat: 43.205,
            lng: 27.91,
            meta: {
              title: 'Renderer test event',
              coverUrl: null,
              startsAt: new Date().toISOString(),
              attendeeCount: 4,
              capacity: 12,
            },
          },
          {
            kind: 'cluster',
            cellId: '891e2040d2fffff',
            lat: 43.214,
            lng: 27.929,
            count: 8,
            by: { user: 6, event: 2 },
          },
        ],
        onViewportSettled: (camera, viewport) => {
          globalThis.__NEXA_MAP_TEST__.settled = { camera, viewport };
        },
      });
    `,
    resolveDir: process.cwd(),
    loader: 'js',
    sourcefile: 'maplibre-renderer-fixture.js',
  },
  bundle: true,
  platform: 'browser',
  format: 'esm',
  target: ['chrome120'],
  write: false,
  logLevel: 'silent',
});
const fixtureJs = fixtureBuild.outputFiles[0]?.text;
if (!fixtureJs) throw new Error('MapLibre E2E fixture bundle was not produced');

const [mapLibreCss, workerSource] = await Promise.all([
  readFile('web/dist/maplibre-gl.css', 'utf8'),
  readFile('web/dist/maplibre-worker.mjs', 'utf8'),
]);

const requests = {
  style: 0,
  worker: 0,
};

const server = createServer((request, response) => {
  const url = new URL(request.url ?? '/', 'http://127.0.0.1');
  setCsp(response);

  if (request.method === 'GET' && url.pathname === '/') {
    response.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8', 'Cache-Control': 'no-store' });
    response.end(`<!doctype html>
      <html>
        <head>
          <meta charset="utf-8">
          <title>NEXA MapLibre E2E</title>
          <link rel="stylesheet" href="/maplibre-gl.css">
          <link rel="stylesheet" href="/fixture.css">
        </head>
        <body>
          <div id="map"></div>
          <script type="module" src="/fixture.js"></script>
        </body>
      </html>`);
    return;
  }

  if (request.method === 'GET' && url.pathname === '/fixture.js') {
    response.writeHead(200, { 'Content-Type': 'text/javascript; charset=utf-8', 'Cache-Control': 'no-store' });
    response.end(fixtureJs);
    return;
  }

  if (request.method === 'GET' && url.pathname === '/fixture.css') {
    response.writeHead(200, { 'Content-Type': 'text/css; charset=utf-8', 'Cache-Control': 'no-store' });
    response.end('html,body,#map{width:100%;height:100%;margin:0} body{overflow:hidden}');
    return;
  }

  if (request.method === 'GET' && url.pathname === '/maplibre-gl.css') {
    response.writeHead(200, { 'Content-Type': 'text/css; charset=utf-8', 'Cache-Control': 'no-store' });
    response.end(mapLibreCss);
    return;
  }

  if (request.method === 'GET' && url.pathname === '/dist/maplibre-worker.mjs') {
    requests.worker += 1;
    response.writeHead(200, { 'Content-Type': 'text/javascript; charset=utf-8', 'Cache-Control': 'no-store' });
    response.end(workerSource);
    return;
  }

  if (request.method === 'GET' && url.pathname === '/style.json') {
    requests.style += 1;
    response.writeHead(200, { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store' });
    response.end(JSON.stringify({
      version: 8,
      name: 'NEXA local renderer test',
      sources: {},
      layers: [{
        id: 'background',
        type: 'background',
        paint: { 'background-color': '#0b0d12' },
      }],
    }));
    return;
  }

  response.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' });
  response.end('Not Found');
});

await new Promise((resolve, reject) => {
  server.once('error', reject);
  server.listen(0, '127.0.0.1', resolve);
});
const address = server.address();
if (!address || typeof address === 'string') throw new Error('failed to resolve MapLibre fixture port');
const baseUrl = `http://127.0.0.1:${address.port}`;
const runtime = await launchChrome('nexa-maplibre-e2e-', { enableWebGl: true });

try {
  const tab = await createTab(
    runtime.cdp,
    `${baseUrl}/`,
    "document.querySelector('#map')?.dataset.mapReady === 'true'",
  );

  assert(requests.style > 0, 'MapLibre did not load the same-origin style document');
  assert(requests.worker > 0, 'MapLibre did not load the same-origin worker');
  assert(
    await evaluate(runtime.cdp, tab, "document.querySelector('#map')?.dataset.mapRenderer === 'maplibre'"),
    'MapLibre renderer marker missing',
  );
  assert(
    await evaluate(runtime.cdp, tab, "document.querySelector('#map')?.dataset.basemapProvider === 'maptiler'"),
    'MapTiler provider marker missing',
  );
  assert(
    await evaluate(runtime.cdp, tab, "document.querySelector('#map')?.dataset.mapLoadError !== 'true'"),
    'MapLibre reported a renderer/style error',
  );
  assert(
    await evaluate(runtime.cdp, tab, "document.querySelector('.maplibregl-canvas') instanceof HTMLCanvasElement"),
    'MapLibre canvas was not created',
  );
  assert(
    await evaluate(runtime.cdp, tab, "document.querySelector('.maplibregl-ctrl-zoom-in') instanceof HTMLButtonElement"),
    'MapLibre navigation controls were not created',
  );

  await evaluate(runtime.cdp, tab, "document.querySelector('.maplibregl-ctrl-zoom-in')?.click()");
  const settled = await waitFor(
    async () => await evaluate(runtime.cdp, tab, 'globalThis.__NEXA_MAP_TEST__?.settled ?? null'),
    4_000,
    'MapLibre viewport settle callback',
  );

  assert(settled.camera.zoom >= 14, `expected zoomed camera, got ${settled.camera.zoom}`);
  assert(
    Number.isFinite(settled.viewport.ne.lat) && Number.isFinite(settled.viewport.sw.lng),
    'MapLibre viewport callback returned non-finite bounds',
  );
  assert(
    settled.viewport.ne.lat > settled.viewport.sw.lat,
    'MapLibre viewport north/south bounds are inverted',
  );

  console.log('NEXA MapLibre E2E passed: pinned renderer bundle, same-origin worker, GeoJSON overlay, WebGL canvas and viewport callback.');
} catch (error) {
  const chromeErrors = runtime.errors();
  if (chromeErrors) console.error(chromeErrors);
  throw error;
} finally {
  await cleanupChrome(runtime);
  await closeServer(server);
}

function setCsp(response) {
  response.setHeader(
    'Content-Security-Policy',
    "default-src 'self'; script-src 'self'; style-src 'self'; img-src 'self' data: blob:; connect-src 'self'; worker-src 'self'; object-src 'none'; base-uri 'none'; frame-ancestors 'none'",
  );
}
