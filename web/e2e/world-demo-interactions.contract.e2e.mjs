import assert from 'node:assert/strict';
import { build } from 'esbuild';
import { readFile } from 'node:fs/promises';

const built = await build({ entryPoints: ['web/src/world-demo-interactions.ts'], bundle:true, platform:'node', format:'esm', target:'node22', write:false });
const js=built.outputFiles?.[0]?.text;
assert.ok(js);
const mod=await import(`data:text/javascript;base64,${Buffer.from(js).toString('base64')}`);
const markers={ 'user:maria':'wave','user:alex':'wave','event:sunset':'rsvp','listing:bike':'offer' };
let state={};
for(const [marker,action] of Object.entries(markers)){
  assert.equal(mod.actionForMarker(marker),action);
  assert.match(mod.demoInteractionMarkup('nexus',marker,state),/NOT SENT · RESETS ON RELOAD/);
  assert.match(mod.demoInteractionMarkup('nexus',marker,state),/aria-pressed="false"/);
  state=mod.toggleDemoInteraction(state,marker);
  assert.equal(state[marker],true);
  assert.match(mod.demoInteractionMarkup('noir',marker,state),/aria-pressed="true"/);
  state=mod.toggleDemoInteraction(state,marker);
  assert.equal(state[marker],false);
}
for(const invalid of ['cluster:busy','user:real','constructor','__proto__','']){
  assert.equal(mod.actionForMarker(invalid),null);
  assert.equal(mod.toggleDemoInteraction(state,invalid),state);
  assert.equal(mod.demoInteractionMarkup('nexus',invalid,state),'');
}
assert.equal(mod.demoInteractionMarkup('nexus',null,state),'');
const source=await readFile('web/src/app.ts','utf8');
assert.match(source,/state\.points !== demoPoints/);
assert.match(source,/state\.selectedDemoMarker !== id/);
assert.match(source,/toggleDemoInteraction\(state\.demoInteractions, id\)/);
assert.doesNotMatch(await readFile('web/src/world-demo-interactions.ts','utf8'), /fetch\(|localStorage|sessionStorage|WebSocket/);
console.log('MANY WORLDS v7 local-only interaction contract: PASS');
