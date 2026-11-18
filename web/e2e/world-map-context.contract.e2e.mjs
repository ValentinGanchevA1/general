import assert from 'node:assert/strict';
import { build } from 'esbuild';
import { readFile } from 'node:fs/promises';

const output = await build({
  entryPoints: ['web/src/world-map-context.ts'],
  bundle: true, platform: 'node', format: 'esm', target: 'node22', write: false,
});
const source = output.outputFiles?.[0]?.text;
assert.ok(source, 'Missing world map context bundle');
const mod = await import(`data:text/javascript;base64,${Buffer.from(source).toString('base64')}`);
const fixtureIds = ['user:maria','user:alex','event:sunset','listing:bike','cluster:busy'];
const worlds = ['nexus','noir','profiler','pathfinder','nocturne','diplomat','architect','bazaar','vanguard','sanctuary'];
assert.deepEqual(Object.keys(mod.DEMO_MAP_MARKERS).sort(), [...fixtureIds].sort());
for (const id of fixtureIds) {
  assert.equal(mod.isDemoMapMarkerId(id), true);
  for (const world of worlds) {
    const markup = mod.worldMapContextMarkup(world, id);
    assert.match(markup, /FICTIONAL/);
    assert.match(markup, /NO LIVE DATA OR REAL ACTIONS/);
    assert.match(markup, /data-close-map-context="1"/);
    assert.match(markup, /role="status"/);
  }
}
for (const invalid of ['user:real-account','user:__proto__','__proto__','constructor','event:private']) {
  assert.equal(mod.isDemoMapMarkerId(invalid), false);
  assert.equal(mod.worldMapContextMarkup('nexus', invalid), '');
}
assert.equal(mod.worldMapContextMarkup('nexus', null), '');
assert.notEqual(mod.worldMapContextMarkup('noir','event:sunset'), mod.worldMapContextMarkup('bazaar','event:sunset'));

const mapSource = await readFile('web/src/map.ts','utf8');
const appSource = await readFile('web/src/app.ts','utf8');
assert.match(mapSource, /onSelectPoint\?: \(point: DiscoveryPoint\) => void/);
assert.match(mapSource, /marker\.addEventListener\('pointerdown', \(event\) => event\.stopPropagation\(\)\)/);
assert.match(mapSource, /onSelectPoint\?\.\(point\)/);
assert.match(appSource, /state\.points !== demoPoints/);
assert.match(appSource, /state\.points === demoPoints/);
assert.match(appSource, /isDemoMapMarkerId\(markerId\)/);
assert.match(appSource, /data-close-map-context/);
console.log('MANY WORLDS v6 fictional map selection contract: PASS');
