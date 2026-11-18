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

for (const world of ['nexus','noir','profiler','pathfinder','nocturne','diplomat','architect','bazaar','vanguard','sanctuary']) {
  const scene = mod.worldSceneMarkup(world);
  assert.match(scene, /class="world-scene"/);
  assert.match(scene, new RegExp(world.toUpperCase()));
  assert.match(scene, /VISUAL CONCEPT · NO WORLD DATA/);
  assert.ok(mod.WORLD_VISUALS[world].subtitle.length > 12);
}
assert.notEqual(mod.worldSceneMarkup('noir'), mod.worldSceneMarkup('sanctuary'));

const location = { href: 'https://example.test/app?foo=bar#map' };
const url = mod.worldUrl('noir', location);
assert.equal(url, '/app?foo=bar&manyWorlds=1&world=noir#map');

const experienceBundle = await build({
  entryPoints: ['web/src/world-experience.ts'],
  bundle: true,
  platform: 'node',
  format: 'esm',
  target: 'node22',
  write: false,
});
const experienceSource = experienceBundle.outputFiles?.[0]?.text;
assert.ok(experienceSource, 'Bundled experience source missing');
const experience = await import(`data:text/javascript;base64,${Buffer.from(experienceSource).toString('base64')}`);
assert.equal(new Set(experience.WORLD_LAYOUTS).size, 10, 'Every world needs a distinct layout');
for (const id of ['nexus','noir','profiler','pathfinder','nocturne','diplomat','architect','bazaar','vanguard','sanctuary']) {
  const initial = experience.worldExperienceMarkup(id, 0);
  const next = experience.worldExperienceMarkup(id, 1);
  assert.match(initial, /class="world-workspace world-layout-/);
  assert.equal((initial.match(/data-world-focus=/g) ?? []).length, 3);
  assert.match(initial, /ILLUSTRATIVE CONTENT · NOT LIVE DATA/);
  assert.notEqual(initial, next, `${id} must change content on interaction`);
  assert.equal(experience.worldExperienceMarkup(id, 99), initial, 'Invalid focus resets to first scene');
}
console.log('MANY WORLDS switcher and experiences: PASS');
