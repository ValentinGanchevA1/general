import { copyFile, mkdir, readFile, writeFile } from 'node:fs/promises';
import { build } from 'esbuild';

const MAPLIBRE_VERSION = '6.15.0';
const DIST_DIR = 'web/dist';
const MAPTILER_EU_ORIGIN = 'https://api.maptiler.eu';
const MAPTILER_GLOBAL_ORIGIN = 'https://api.maptiler.com';

await mkdir(DIST_DIR, { recursive: true });
await assertPinnedMapLibreVersion();

await build({
  entryPoints: ['web/src/app.ts'],
  bundle: true,
  platform: 'browser',
  format: 'esm',
  target: ['es2022'],
  outfile: `${DIST_DIR}/app.js`,
  sourcemap: true,
  logLevel: 'info',
});

await Promise.all([
  copyFile(
    'web/node_modules/maplibre-gl/dist/maplibre-gl-worker.mjs',
    `${DIST_DIR}/maplibre-worker.mjs`,
  ),
  copyFile(
    'web/node_modules/maplibre-gl/dist/maplibre-gl.css',
    `${DIST_DIR}/maplibre-gl.css`,
  ),
  writeFile(
    `${DIST_DIR}/map-config.js`,
    `globalThis.__NEXA_MAP_CONFIG__ = Object.freeze(${JSON.stringify(resolveMapBuildConfig())});\n`,
    'utf8',
  ),
]);

async function assertPinnedMapLibreVersion() {
  const raw = await readFile('web/node_modules/maplibre-gl/package.json', 'utf8');
  const parsed = JSON.parse(raw);
  if (parsed?.version !== MAPLIBRE_VERSION) {
    throw new Error(`Expected maplibre-gl ${MAPLIBRE_VERSION}, got ${String(parsed?.version ?? 'unknown')}`);
  }
}

function resolveMapBuildConfig() {
  const apiKey = process.env.NEXA_MAPTILER_API_KEY ?? '';
  const mapId = process.env.NEXA_MAPTILER_MAP_ID ?? 'streets-v4';
  const region = process.env.NEXA_MAPTILER_REGION ?? 'eu';

  if (apiKey.length > 256 || /[\u0000-\u0020\u007f]/u.test(apiKey)) {
    throw new Error('NEXA_MAPTILER_API_KEY contains invalid whitespace/control characters');
  }
  if (!/^[A-Za-z0-9][A-Za-z0-9_-]{0,63}$/u.test(mapId)) {
    throw new Error('NEXA_MAPTILER_MAP_ID must be a simple MapTiler map identifier');
  }
  if (region !== 'eu' && region !== 'global') {
    throw new Error('NEXA_MAPTILER_REGION must be either eu or global');
  }

  return {
    maptilerApiKey: apiKey,
    maptilerMapId: mapId,
    maptilerApiOrigin: region === 'eu' ? MAPTILER_EU_ORIGIN : MAPTILER_GLOBAL_ORIGIN,
  };
}
