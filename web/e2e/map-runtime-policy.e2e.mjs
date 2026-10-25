import { build } from 'esbuild';

const result = await build({
  entryPoints: ['web/src/map-runtime.ts'],
  bundle: true,
  platform: 'node',
  format: 'esm',
  target: ['node22'],
  write: false,
  logLevel: 'silent',
});

const source = result.outputFiles[0]?.text;
if (!source) throw new Error('map runtime policy bundle was not produced');

const encoded = Buffer.from(source, 'utf8').toString('base64');
const runtime = await import(`data:text/javascript;base64,${encoded}`);

const local = runtime.resolveMapRuntime({ protocol: 'http:', hostname: '127.0.0.1' });
assert(local.status === 'ready', 'loopback preview must have a ready basemap runtime');
assert(local.renderer === 'preview-raster', 'loopback preview must use the raster renderer');
assert(local.provider === 'osm-preview', 'loopback preview must use the OSM preview provider');
assert(
  runtime.previewRasterTileUrl(local, 13, 4729, 3021) === 'https://tile.openstreetmap.org/13/4729/3021.png',
  'preview tile URL must be built from the fixed OSM template',
);

const localhost = runtime.resolveMapRuntime({ protocol: 'https:', hostname: 'localhost' });
assert(localhost.status === 'ready', 'HTTPS localhost must remain a local preview');

const publicRuntime = runtime.resolveMapRuntime({ protocol: 'https:', hostname: 'app.nexa.example' });
assert(publicRuntime.status === 'blocked', 'public origins must fail closed before MapLibre is bundled');
assert(publicRuntime.renderer === 'maplibre', 'production target renderer must be MapLibre');
assert(publicRuntime.provider === 'maptiler', 'production beta target provider must be MapTiler');
assert(publicRuntime.workerUrl === '/maplibre-worker.mjs', 'MapLibre worker must be same-origin');
assert(
  runtime.previewRasterTileUrl(publicRuntime, 13, 4729, 3021) === null,
  'public origins must never produce an OSM standard preview tile URL',
);
assert(
  !JSON.stringify(publicRuntime).includes('tile.openstreetmap.org'),
  'blocked production runtime must not carry the OSM standard tile host',
);

const nonWeb = runtime.resolveMapRuntime({ protocol: 'file:', hostname: '' });
assert(nonWeb.status === 'blocked', 'non-HTTP browser contexts must fail closed');

console.log('NEXA map runtime policy passed: loopback-only OSM preview, fail-closed public MapLibre target, same-origin worker.');

function assert(condition, message) {
  if (!condition) throw new Error(message);
}
