import assert from 'node:assert/strict';
import { build } from 'esbuild';

const result = await build({
  entryPoints: ['web/src/world-experience.ts'],
  bundle: true, platform: 'node', format: 'esm', target: 'node22', write: false,
});
const source = result.outputFiles?.[0]?.text;
assert.ok(source, 'World experience bundle missing');
const mod = await import(`data:text/javascript;base64,${Buffer.from(source).toString('base64')}`);
const ids = ['nexus','noir','profiler','pathfinder','nocturne','diplomat','architect','bazaar','vanguard','sanctuary'];
assert.equal(new Set(mod.WORLD_LAYOUTS).size, 10, 'Each world must have its own layout');
for (const id of ids) {
  const defaultView = mod.worldExperienceMarkup(id, 0);
  assert.match(defaultView, new RegExp('world-layout-' + mod.WORLD_EXPERIENCES[id].mode));
  assert.match(defaultView, /ILLUSTRATIVE CONTENT · NOT LIVE DATA/);
  assert.equal((defaultView.match(/data-world-focus=/g) ?? []).length, 3);
  assert.match(defaultView, /aria-pressed="true"/);
  const second = mod.worldExperienceMarkup(id, 1);
  const third = mod.worldExperienceMarkup(id, 2);
  assert.notEqual(defaultView, second);
  assert.notEqual(second, third);
  assert.equal(mod.worldExperienceMarkup(id, 999), defaultView, 'Invalid selection must be bounded');
  for (const moment of mod.WORLD_EXPERIENCES[id].moments) {
    assert.ok(moment.detail.length > 24);
  }
}
assert.notEqual(mod.worldExperienceMarkup('noir',0), mod.worldExperienceMarkup('bazaar',0));
assert.match(mod.worldExperienceMarkup('sanctuary', 0), /role="group" aria-label="Concept scenes"/);
assert.match(mod.worldExperienceMarkup('nexus', 0), /aria-live="polite"/);
console.log('MANY WORLDS interactive experience contract: PASS');
