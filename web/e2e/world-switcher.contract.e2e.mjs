import assert from 'node:assert/strict';
import { build } from 'esbuild';

const result = await build({
  entryPoints: ['web/src/world-switcher.ts'],
  bundle: true,
  platform: 'node',
  format: 'esm',
  target: 'node22',
  write: false,
});
const source = result.outputFiles?.[0]?.text;
assert.ok(source, 'Bundled world-switcher source missing');
const mod = await import(`data:text/javascript;base64,${Buffer.from(source).toString('base64')}`);

assert.equal(mod.manyWorldsPreviewEnabled('?manyWorlds=1'), true);
assert.equal(mod.manyWorldsPreviewEnabled('?manyWorlds=0'), false);
assert.equal(mod.manyWorldsPreviewEnabled(''), false);
assert.equal(mod.worldFromSearch('?world=pathfinder'), 'pathfinder');
assert.equal(mod.worldFromSearch('?world=unknown'), 'nexus');
assert.equal(mod.worldFromSearch('?world=__proto__'), 'nexus');

const html = mod.worldPickerMarkup('bazaar');
assert.equal((html.match(/data-world=/g) ?? []).length, 10);
assert.match(html, /data-world="bazaar" aria-current="true"/);
assert.match(html, /NOIR · Preview/);

const location = { href: 'https://example.test/app?foo=bar#map' };
const url = mod.worldUrl('noir', location);
assert.equal(url, '/app?foo=bar&manyWorlds=1&world=noir#map');
console.log('MANY WORLDS switcher contracts: PASS');
