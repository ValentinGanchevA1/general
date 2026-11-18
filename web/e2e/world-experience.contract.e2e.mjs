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

assert.deepEqual(Object.keys(mod.WORLD_EXPERIENCES).sort(), [...ids].sort());
for (const id of ids) {
  const actions = mod.WORLD_EXPERIENCES[id].actions;
  assert.equal(actions.length, 3);
  assert.equal(new Set(actions.map((action) => action.id)).size, 3);
  const defaultView = mod.worldExperienceMarkup(id);
  assert.match(defaultView, /class="world-experience"/);
  assert.match(defaultView, /INTERACTIVE CONCEPT/);
  assert.match(defaultView, /PREVIEW ONLY/);
  assert.equal((defaultView.match(/data-world-action=/g) ?? []).length, 3);
  assert.equal((defaultView.match(/aria-pressed="true"/g) ?? []).length, 1);
  for (const action of actions) {
    assert.ok(action.detail.length > 24);
    const selected = mod.worldExperienceMarkup(id, action.id);
    assert.match(selected, new RegExp(`data-world-action="${action.id}" aria-pressed="true"`));
  }
  assert.equal(mod.worldExperienceMarkup(id, '__invalid__'), defaultView);
}
assert.notEqual(mod.worldExperienceMarkup('noir'), mod.worldExperienceMarkup('bazaar'));
console.log('MANY WORLDS interactive experience contract: PASS');
