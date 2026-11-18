import assert from 'node:assert/strict';
import { build } from 'esbuild';
import { readFile } from 'node:fs/promises';

const built = await build({
  entryPoints: ['web/src/world-mobile-tools.ts'],
  bundle: true, platform: 'node', format: 'esm', target: 'node22', write: false,
});
const source = built.outputFiles?.[0]?.text;
assert.ok(source, 'Missing mobile tools bundle');
const mobile = await import(`data:text/javascript;base64,${Buffer.from(source).toString('base64')}`);
const worlds = ['nexus','noir','profiler','pathfinder','nocturne','diplomat','architect','bazaar','vanguard','sanctuary'];
for (const world of worlds) {
  const dock = mobile.worldMobileDockMarkup(world, null);
  assert.equal((dock.match(/data-mobile-action=/g) ?? []).length, 3);
  assert.match(dock, /DEMO/);
  assert.equal(mobile.worldMobileSheetMarkup(world, null), '');
  const actionId = /data-mobile-action="([^"]+)"/.exec(dock)?.[1];
  assert.ok(actionId);
  const activeDock = mobile.worldMobileDockMarkup(world, actionId);
  assert.equal((activeDock.match(/aria-pressed="true"/g) ?? []).length, 1);
  const sheet = mobile.worldMobileSheetMarkup(world, actionId);
  assert.match(sheet, /role="dialog" aria-modal="true"/);
  assert.match(sheet, /id="world-sheet-close"/);
  assert.match(sheet, /PREVIEW ONLY/);
  assert.match(sheet, /No live services or user data/);
  assert.equal(mobile.worldMobileSheetMarkup(world, '__invalid__'), '');
}
const app = await readFile('web/src/app.ts', 'utf8');
const styles = await readFile('web/styles.css', 'utf8');
assert.match(app, /data-mobile-action/);
assert.match(app, /data-close-world-sheet/);
assert.match(app, /event\.key === 'Escape'/);
assert.match(app, /state\.mobileSheetOpen = false;/);
assert.match(styles, /bottom:calc\(70px \+ env\(safe-area-inset-bottom\)\)/);
assert.match(styles, /min-height:50px/);
assert.match(styles, /max-height:min\(72dvh,560px\)/);
console.log('MANY WORLDS v5 mobile dock and modal concept contract: PASS');
