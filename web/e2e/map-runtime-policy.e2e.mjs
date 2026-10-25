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

const publicWithoutConfig = runtime.resolveMapRuntime(
  { protocol: 'https:', hostname: 'app.nexa.example' },
  undefined,
);
assert(publicWithoutConfig.status === 'blocked', 'public origins must fail closed without provider config');
assert(
  publicWithoutConfig.reason === 'production-map-provider-not-configured',
  'missing provider config must have an explicit fail-closed reason',
);
assert(publicWithoutConfig.workerUrl === '/dist/maplibre-worker.mjs', 'MapLibre worker must be same-origin');

const validEuConfig = {
  maptilerApiKey: 'demo-key_123',
  maptilerMapId: 'streets-v4',
  maptilerApiOrigin: 'https://api.maptiler.eu',
};
const publicEu = runtime.resolveMapRuntime(
  { protocol: 'https:', hostname: 'app.nexa.example' },
  validEuConfig,
);
assert(publicEu.status === 'ready', 'valid HTTPS EU config must activate the production map');
assert(publicEu.renderer === 'maplibre', 'production renderer must be MapLibre');
assert(publicEu.provider === 'maptiler', 'production provider must be MapTiler');
assert(publicEu.apiOrigin === 'https://api.maptiler.eu', 'EU config must stay on the EU API origin');
assert(
  publicEu.styleUrl === 'https://api.maptiler.eu/maps/streets-v4/style.json?key=demo-key_123',
  `unexpected EU style URL: ${publicEu.styleUrl}`,
);
assert(
  runtime.previewRasterTileUrl(publicEu, 13, 4729, 3021) === null,
  'production MapLibre runtime must never produce an OSM standard preview tile URL',
);

const validGlobalConfig = {
  ...validEuConfig,
  maptilerApiOrigin: 'https://api.maptiler.com',
};
const publicGlobal = runtime.resolveMapRuntime(
  { protocol: 'https:', hostname: 'app.nexa.example' },
  validGlobalConfig,
);
assert(publicGlobal.status === 'ready', 'valid global MapTiler config must be accepted');
assert(publicGlobal.apiOrigin === 'https://api.maptiler.com', 'global config must stay on the global API origin');

const insecurePublic = runtime.resolveMapRuntime(
  { protocol: 'http:', hostname: 'app.nexa.example' },
  validEuConfig,
);
assert(insecurePublic.status === 'blocked', 'non-loopback HTTP production origin must fail closed');
assert(
  insecurePublic.reason === 'production-map-requires-https',
  'HTTP production origin must identify the HTTPS requirement',
);

const arbitraryProvider = runtime.resolveMapRuntime(
  { protocol: 'https:', hostname: 'app.nexa.example' },
  { ...validEuConfig, maptilerApiOrigin: 'https://tiles.attacker.example' },
);
assert(arbitraryProvider.status === 'blocked', 'arbitrary provider origins must be rejected');

const invalidMapId = runtime.resolveMapRuntime(
  { protocol: 'https:', hostname: 'app.nexa.example' },
  { ...validEuConfig, maptilerMapId: '../secret' },
);
assert(invalidMapId.status === 'blocked', 'path-like map identifiers must be rejected');

const invalidKey = runtime.resolveMapRuntime(
  { protocol: 'https:', hostname: 'app.nexa.example' },
  { ...validEuConfig, maptilerApiKey: 'bad key' },
);
assert(invalidKey.status === 'blocked', 'keys with whitespace/control characters must be rejected');

const nonWeb = runtime.resolveMapRuntime({ protocol: 'file:', hostname: '' }, validEuConfig);
assert(nonWeb.status === 'blocked', 'non-HTTP browser contexts must fail closed');

console.log('NEXA map runtime policy passed: loopback-only OSM preview, HTTPS-only MapLibre activation, exact MapTiler origins, same-origin worker.');

function assert(condition, message) {
  if (!condition) throw new Error(message);
}
