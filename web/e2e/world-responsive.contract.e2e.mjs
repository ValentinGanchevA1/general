import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const css = await readFile('web/styles.css', 'utf8');
const app = await readFile('web/src/app.ts', 'utf8');
const html = await readFile('web/index.html', 'utf8');

assert.match(html, /name="viewport" content="width=device-width, initial-scale=1\.0"/);
assert.match(css, /@media\(max-width:760px\)/);
assert.match(css, /@media\(max-width:380px\)/);
assert.match(css, /@media\(min-width:761px\) and \(max-width:1100px\)/);
assert.match(css, /\.content>\.map-layout[\s\S]*?order:-2/);
assert.match(css, /\.world-choices\{[^}]*overflow-x:auto/);
assert.match(css, /\.world-choices\{[^}]*scroll-snap-type:x proximity/);
assert.match(css, /\.world-choice\{[^}]*min-height:44px/);
assert.match(css, /\.world-scene\{display:none\}/);
assert.match(css, /env\(safe-area-inset-bottom\)/);
assert.match(css, /height:clamp\(315px,48dvh,500px\)/);
assert.match(app, /selected\.offsetLeft - \(picker\.clientWidth - selected\.clientWidth\) \/ 2/);
assert.match(app, /const preservedMap = isSpatialTab\(state\.tab\)/);
console.log('MANY WORLDS responsive shell contract: PASS (320/360/412/760/768/1100 breakpoints; device QA still required)');
