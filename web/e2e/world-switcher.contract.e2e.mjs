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

const experienceResult = await build({
  entryPoints: ['web/src/world-experience.ts'],
  bundle: true,
  platform: 'node',
  format: 'esm',
  target: 'node22',
  write: false,
});
const experienceSource = experienceResult.outputFiles?.[0]?.text;
assert.ok(experienceSource, 'Bundled world experience source missing');
const experience = await import(`data:text/javascript;base64,${Buffer.from(experienceSource).toString('base64')}`);

for (const world of ['nexus','noir','profiler','pathfinder','nocturne','diplomat','architect','bazaar','vanguard','sanctuary']) {
  const defaultMarkup = experience.worldExperienceMarkup(world);
  assert.match(defaultMarkup, /class="world-experience"/);
  assert.equal((defaultMarkup.match(/data-world-action=/g) ?? []).length, 3);
  assert.equal((defaultMarkup.match(/aria-pressed="true"/g) ?? []).length, 1);
  assert.match(defaultMarkup, /PREVIEW ONLY/);
  const actions = experience.WORLD_EXPERIENCES[world].actions;
  assert.equal(actions.length, 3);
  assert.equal(new Set(actions.map((action) => action.id)).size, 3);
  for (const action of actions) {
    assert.match(experience.worldExperienceMarkup(world, action.id), new RegExp(`data-world-action="${action.id}" aria-pressed="true"`));
  }
  assert.equal(experience.worldExperienceMarkup(world, '__invalid__'), defaultMarkup);
}
assert.notEqual(experience.worldExperienceMarkup('noir'), experience.worldExperienceMarkup('sanctuary'));


const stageResult = await build({
  entryPoints: ['web/src/world-workspaces.ts'],
  bundle: true,
  platform: 'node',
  format: 'esm',
  target: 'node22',
  write: false,
});
const stageSource = stageResult.outputFiles?.[0]?.text;
assert.ok(stageSource, 'Bundled world workspaces missing');
const stage = await import(`data:text/javascript;base64,${Buffer.from(stageSource).toString('base64')}`);
const stageWorlds = ['nexus','noir','profiler','pathfinder','nocturne','diplomat','architect','bazaar','vanguard','sanctuary'];
assert.equal(new Set(stageWorlds.map((world) => stage.WORLD_STAGES[world].layout)).size, 10);
for (const world of stageWorlds) {
  const html = stage.worldStageMarkup(world);
  assert.match(html, /class="stage-canvas"/);
  assert.match(html, /DEMO ONLY/);
  assert.match(html, /NO REAL ACTIONS/);
  assert.equal((html.match(/class="stage-node/g) ?? []).length, 3);
  const lastAction = experience.WORLD_EXPERIENCES[world].actions[2];
  const selected = stage.worldStageMarkup(world, lastAction.id);
  assert.match(selected, new RegExp(lastAction.title));
  assert.notEqual(html, selected);
  assert.equal(stage.worldStageMarkup(world, '__invalid__'), html);
}

console.log('MANY WORLDS switcher, experiences and unique workspace contracts: PASS');
